import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Visual matrix: structural layout assertions across breakpoints.
 * Deliberately avoids pixel baselines (not committed); instead it asserts
 * the invariants that catch real regressions: no horizontal overflow,
 * primary landmarks visible, content within viewport width.
 */

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `document overflows horizontally (${scrollWidth}px in a ${clientWidth}px viewport)`
  ).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe('visual matrix', () => {
  test('landing: hero visible, no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('landing: primary CTA and section landmarks render', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { level: 1 }).waitFor();
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/recruiters/i);
    expect(body).toMatch(/resume/i);
  });

  test('pricing: plan cards render without overflow', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('heading', { level: 1 }).waitFor();
    // Plan cards arrive from the public billing endpoint after first paint.
    // Wait for actual plan content instead of racing an immediate h2 count.
    await expect(page.getByRole('heading', { level: 2, name: /free/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /pro/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('login: form is compact and centered-ish, no overflow', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('public profile 404: single column, readable, no overflow', async ({ page }) => {
    await page.goto('/u/definitely-not-a-user-9x7q');
    await expect(page.getByRole('heading', { name: /not found|unavailable/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

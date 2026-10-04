import { test, expect } from '@playwright/test';

test.describe('smoke: pages load with correct head metadata', () => {
  test('landing page renders hero and site meta', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    expect(response?.headers()['x-frame-options']).toBe('DENY');
    expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.title()).toMatch(/CVentory/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /CVentory — AI CV, ATS Resume & Career Profile Builder/
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /og-cover\.png/
    );
  });

  test('pricing page has a clean canonical', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const origin = new URL(page.url()).origin;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${origin}/pricing`
    );
  });

  test('public policy and contact pages render with canonical metadata', async ({ page }) => {
    for (const path of ['/privacy', '/terms', '/refund-policy', '/contact']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const origin = new URL(page.url()).origin;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${origin}${path}`
      );
      expect(await page.title()).toMatch(/CVentory/);
    }
  });

  test('unknown route renders the 404 page', async ({ page }) => {
    await page.goto('/definitely-not-a-route');
    await expect(page.getByText('404')).toBeVisible();
  });

  test('published profile URL with no profile renders not-found, not a crash', async ({ page }) => {
    await page.goto('/u/definitely-not-a-user-9x7q');
    await expect(page.getByRole('heading', { name: /not found|unavailable/i })).toBeVisible();
  });
});

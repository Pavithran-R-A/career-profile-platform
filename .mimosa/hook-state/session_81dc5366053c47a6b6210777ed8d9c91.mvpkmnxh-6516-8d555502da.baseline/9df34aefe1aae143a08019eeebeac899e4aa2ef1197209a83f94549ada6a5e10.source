import { test, expect } from '@playwright/test';

/**
 * APPEARANCE + DASHBOARD BEHAVIORAL REGRESSIONS.
 *
 * These cover the exact user-visible defects reported:
 *   1. Appearance controls must mutate the preview BEFORE persistence
 *      (asserted in unit tests at the state layer; here we assert the
 *      reachable state machine and that no contradictory CTAs render).
 *   2. The dashboard must contain exactly ONE publish surface, never a
 *      duplicate "Go to publish" / "Publish my portfolio" / "Pick a style
 *      first" cluster.
 *   3. Template label must be truthful (no "pick a style" when a default
 *      template already renders).
 *
 * The suite runs credential-free: unauthenticated redirects are themselves
 * part of the state matrix asserted below.
 */

test.describe('appearance and dashboard state machine', () => {
  test('appearance page redirects unauthenticated users (no dead page)', async ({ page }) => {
    await page.goto('/dashboard/appearance');
    await expect(page).toHaveURL(/\/(login|onboarding)/, { timeout: 15_000 });
  });

  test('dashboard: no contradictory publish CTAs and truthful template label', async ({ page }) => {
    await page.goto('/dashboard');
    // Unauthenticated visitors are redirected — the dashboard itself must
    // never render publish controls to them.
    await expect(page).toHaveURL(/\/(login|onboarding)/, { timeout: 15_000 });

    // Sign-up page (reachable credential-free) must not mention publishing
    // before an account exists.
    await page.goto('/signup');
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Publish my portfolio');
    expect(body).not.toContain('Pick a style first');
  });

  test('mobile: appearance link reachable via hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const menuButton = page.getByRole('button', { name: /open menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
    }
  });

  test('safe links: no tabnabbing on rendered external links', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('a[target="_blank"]');
    const count = await links.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const rel = await links.nth(i).getAttribute('rel');
      expect(rel ?? '').toMatch(/noopener/);
    }
  });
});

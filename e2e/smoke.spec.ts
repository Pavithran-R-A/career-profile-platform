import { test, expect } from '@playwright/test';

test.describe('smoke: pages load with correct head metadata', () => {
  test('landing page renders hero and site meta', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    expect(response?.headers()['x-frame-options']).toBe('DENY');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    await expect(page.locator('meta[name="csp-nonce"]')).toHaveAttribute('content', nonce!);
    const jsonLdNonce = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .evaluate((node) => (node as HTMLScriptElement).nonce);
    expect(jsonLdNonce).toBe(nonce);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.title()).toMatch(/CareerProfile Go/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /CareerProfile Go — Career Profile, ATS Resume & Portfolio Builder/
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
      expect(await page.title()).toMatch(/CareerProfile Go/);
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

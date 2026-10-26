import { expect, test } from '@playwright/test';

// Deployed-browser evidence for auth error wording: the customer UI may only
// ever show the fixed copy from toSafeAuthMessage / the callback pages —
// never raw provider diagnostics or URL error_description content.
const FORBIDDEN =
  /error_description|invalid jwt|pgrst|postgres|sqlstate|10\.\d+\.\d+\.\d+|evil\.example/i;

test.describe('deployed auth error feedback', () => {
  test('a wrong password shows fixed customer-safe copy only', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await page.getByLabel('Email').fill('qa-auth-smoke-missing@example.test');
    await page.getByLabel('Password', { exact: true }).fill('WrongPass!1234');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 20_000 });
    const text = (await alert.textContent()) ?? '';
    // Ordinary credential errors must have useful wording, not a generic wall.
    expect(text).toMatch(/Invalid email or password\.|Too many attempts\./);
    expect(text).not.toMatch(FORBIDDEN);
  });

  test('a crafted GitHub callback error_description never renders', async ({ page }) => {
    const crafted = 'host=10.9.9.9 contact evil.example';
    const response = await page.goto(
      '/dashboard/github/callback?error=access_denied&error_description=' +
        encodeURIComponent(crafted),
      { waitUntil: 'domcontentloaded' }
    );
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Could not connect GitHub' })).toBeVisible({
      timeout: 15_000,
    });
    const body = (await page.locator('body').textContent()) ?? '';
    expect(body).not.toContain('10.9.9.9');
    expect(body).not.toContain('evil.example');
    expect(body).not.toMatch(FORBIDDEN);
  });

  test('a crafted auth callback error_description maps to fixed copy only', async ({ page }) => {
    const crafted = 'host=10.8.8.8 continue at evil.example';
    const response = await page.goto(
      '/auth/callback?error=access_denied&error_description=' + encodeURIComponent(crafted),
      { waitUntil: 'domcontentloaded' }
    );
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Verification failed' })).toBeVisible({
      timeout: 15_000,
    });
    const body = (await page.locator('body').textContent()) ?? '';
    // Unrecognized descriptions must fall back to fixed copy, verbatim URL
    // text must never reach the customer.
    expect(body).toContain('Something went wrong. Please try again.');
    expect(body).not.toContain('10.8.8.8');
    expect(body).not.toContain('evil.example');
    expect(body).not.toMatch(FORBIDDEN);
  });
});

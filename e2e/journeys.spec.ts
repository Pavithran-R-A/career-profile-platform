import { test, expect } from '@playwright/test';

test.describe('guest journeys', () => {
  test('landing → pricing → sign-in flow stays coherent', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { level: 1 }).waitFor();

    const pricingLink = page.getByRole('link', { name: /pricing/i }).first();
    await expect(pricingLink).toBeVisible();
    await pricingLink.click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // On narrow viewports the guest nav collapses into the mobile menu.
    const signInLink = page.getByRole('link', { name: /sign in/i }).first();
    if (!(await signInLink.isVisible())) {
      await page.getByRole('button', { name: /open menu/i }).click();
    }
    await signInLink.click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('login page is noindex and keeps the safe-redirect form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // Submitting an empty form must not navigate anywhere external.
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signup page is noindex and validates client-side', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    // Native validation passes (valid email shape, required filled); the
    // app-level password-length rule must then surface a visible error.
    await page.getByLabel(/email/i).fill('guest-e2e@example.com');
    await page.getByLabel(/^password$/i).fill('short');
    await page.getByLabel(/confirm password/i).fill('short');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('dashboard redirects signed-out visitors to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

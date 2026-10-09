import { expect, test } from '@playwright/test';

// Browser evidence against the actual deployed Worker; no mocks or credentials.
test.describe('deployed guest acceptance', () => {
  test('Worker health returns live JSON', async ({ request }) => {
    const response = await request.get('/api/health', { timeout: 20_000 });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { status?: string; buildSha?: string };
    expect(body.status).toBe('ok');
    // Release acceptance must prove the deployed Worker corresponds to
    // the exact checkout, not an older healthy instance.
    if (process.env.E2E_EXPECT_SHA) {
      expect(body.buildSha, 'Deployed Worker SHA does not match tested git HEAD').toBe(
        process.env.E2E_EXPECT_SHA
      );
    }
  });

  test('homepage renders and does not navigate its demo links', async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.name));
    const response = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/CareerProfile Go/);
    // Fictional demo portfolio URLs are illustrations, not real destinations.
    const demoLinks = page.locator('[role="img"] a[href*="example.com"]');
    for (let i = 0; i < (await demoLinks.count()); i++) {
      expect(await demoLinks.nth(i).evaluate((el) => Boolean(el.closest('[inert]')))).toBe(true);
    }
    expect(failures).toEqual([]);
  });

  test('email/password login form loads without a GitHub account', async ({ page }) => {
    const response = await page.goto('/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });

  test('email/password signup form loads without a GitHub account', async ({ page }) => {
    const response = await page.goto('/signup', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(response?.status()).toBe(200);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('a nonexistent public profile is not disclosed', async ({ request }) => {
    const response = await request.get('/api/public/profile/qa-nonexistent-9x7q');
    expect(response.status()).toBe(404);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe('PROFILE_NOT_FOUND');
  });
});

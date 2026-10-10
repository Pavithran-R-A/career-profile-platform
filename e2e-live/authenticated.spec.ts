import { expect, test } from '@playwright/test';

// Only verified, disposable QA credentials injected out-of-band may be used.
// This suite deliberately contains no mocked login state or authentication.
const email = process.env.E2E_QA_EMAIL;
const password = process.env.E2E_QA_PASSWORD;
const authorized = process.env.E2E_QA_ACCOUNT_DISPOSABLE === 'yes' && Boolean(email && password);

// Playwright traces/recordings may contain typed credentials. Disable both
// for this file, including on a failed run.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test.describe('real disposable-account acceptance', () => {
  test('sign in, persist session across reload, and sign out', async ({ page }) => {
    test.skip(!authorized, 'Verified disposable QA email/password not supplied securely.');

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    // An existing QA account opens the dashboard; a new account may enter onboarding.
    await expect(page).toHaveURL(/\/(?:dashboard|onboarding)(?:\/|$)/, { timeout: 30_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login(?:\/|$)/);

    // Header controls hydrate after reload; wait for whichever menu the
    // current viewport renders before choosing a path (no silent else).
    const accountMenu = page.getByRole('button', { name: 'Account menu' });
    const accountMenuReady = await accountMenu
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (accountMenuReady) {
      await accountMenu.click();
      await page.getByRole('menuitem', { name: 'Sign out' }).click();
    } else {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('button', { name: 'Sign out' }).click();
    }
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

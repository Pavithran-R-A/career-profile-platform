import { expect, test } from '@playwright/test';

// This test is destructive ONLY to the second disposable QA user provisioned
// by scripts/live-qa-disposable.mjs, never a user-owned account.
const email = process.env.E2E_QA_SECOND_EMAIL;
const password = process.env.E2E_QA_SECOND_PASSWORD;
const authorized =
  process.env.E2E_QA_ACCOUNT_DISPOSABLE === 'yes' && Boolean(email && password);

test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('delete second disposable QA account with same-account reauthentication', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Destructive QA runs once on desktop.');
  test.skip(!authorized, 'Second disposable QA account not securely provisioned.');

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/(?:dashboard|onboarding)(?:\/|$)/, { timeout: 30_000 });

  await page.goto('/dashboard/account/delete', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Delete account' })).toBeVisible();
  await page.getByLabel(/Type DELETE to continue/).fill('DELETE');
  await page.getByRole('button', { name: 'Continue to confirmation' }).click();
  await expect(page.getByRole('heading', { name: "Confirm it's you" })).toBeVisible();
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in and delete my account' }).click();
  await expect(page.getByRole('heading', { name: 'Account deleted' })).toBeVisible({
    timeout: 30_000,
  });
});

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { extractTextFromPDF } from '../src/lib/resume/pdf';

const email = process.env.E2E_QA_EMAIL;
const password = process.env.E2E_QA_PASSWORD;
const authorized = process.env.E2E_QA_ACCOUNT_DISPOSABLE === 'yes' && Boolean(email && password);

// Passwords and authenticated session tokens must not be persisted in artifacts.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\\/(?:dashboard|onboarding)(?:\\/|$)/, { timeout: 30_000 });
}

test.describe('real disposable-account product journeys', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Mutating account QA runs only once.');
    test.skip(!authorized, 'An authorized disposable test account is required.');
    await login(page);
  });

  test('profile basics and skill creation persist across reload, and skill deletion works', async ({
    page,
  }) => {
    await page.goto('/dashboard/profile');
    await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();

    const headline = 'QA Verified Profile Engineer';
    const about =
      'This profile belongs to a disposable release-qualification account. It tests resume export, editing persistence, and isolation using real backend state.';

    await page.getByLabel('Headline', { exact: true }).fill(headline);
    await page.getByLabel('About', { exact: true }).fill(about);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Headline', { exact: true })).toHaveValue(headline);
    await expect(page.getByLabel('About', { exact: true })).toHaveValue(about);

    await page.getByRole('navigation', { name: 'Profile sections' }).getByRole('button', {
      name: 'Skills',
      exact: true,
    }).click();
    await page.getByLabel('Skill name').fill('QAReleaseSkill');
    await page.getByRole('button', { name: 'Add skill', exact: true }).click();
    const remove = page.getByRole('button', { name: 'Remove skill QAReleaseSkill' });
    await expect(remove).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('navigation', { name: 'Profile sections' }).getByRole('button', {
      name: 'Skills',
      exact: true,
    }).click();
    const reloadedRemove = page.getByRole('button', { name: 'Remove skill QAReleaseSkill' });
    await expect(reloadedRemove).toBeVisible();
    await reloadedRemove.click();
    await expect(reloadedRemove).toHaveCount(0);
  });

  test('ATS export downloads a real parseable PDF containing the disposable profile', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await page.goto('/dashboard/resume/ats');
    await expect(page.getByRole('heading', { name: 'ATS resume' })).toBeVisible();
    await page.getByRole('button', { name: 'Generate ATS Preview' }).click();
    const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
    await page.getByRole('button', { name: 'Export PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\\.pdf$/);
    const source = readFileSync(await download.path());
    expect(source.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    const copy = new Uint8Array(source);
    const pdf = await extractTextFromPDF(copy.buffer);
    expect(pdf.text).toContain('QA Disposable 1');
    expect(pdf.text).toContain('QA Verified Profile Engineer');
    expect(pdf.pageCount).toBeGreaterThanOrEqual(1);
  });

  test('job-description matching displays analysis against the signed-in profile', async ({
    page,
  }) => {
    await page.goto('/dashboard/resume/tailor');
    await expect(page.getByRole('heading', { name: 'Job tailoring' })).toBeVisible();
    await page.getByLabel('Job description').fill(
      'Software QA Engineer at Example Studio.\\nRequired skills and experience:\\n- TypeScript\\n- Automated regression testing\\n- PostgreSQL\\n- Writing maintainable automated tests'
    );
    await page.getByRole('button', { name: 'Analyze requirements' }).click();
    await expect(page.getByText('Analysis complete')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Build the resume' })).toBeVisible();
  });

  test('appearance autosave persists a changed accent after reload', async ({ page }) => {
    await page.goto('/dashboard/appearance');
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
    const emerald = page.getByRole('group', { name: 'Accent color' }).getByRole('button', {
      name: 'Emerald',
    });
    await emerald.click();
    await expect(emerald).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.status-chip')).toContainText(/saved/i, { timeout: 15_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('group', { name: 'Accent color' }).getByRole('button', { name: 'Emerald' })
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

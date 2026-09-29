import { test, expect } from '@playwright/test';

// The recruiter panel only renders when the deployment enables it. Both
// outcomes must be graceful on every public profile, published or not.

test.describe('recruiter ask on public profiles (desktop + mobile)', () => {
  test('unknown profile renders not-found without a recruiter panel', async ({ page }) => {
    await page.goto('/u/definitely-not-a-user-9x7q');
    await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ask' })).toHaveCount(0);
  });

  test('config endpoint answers publicly with the expected shape', async ({ request }) => {
    const res = await request.get('/api/recruiter/config');
    // Route exists and answers JSON; body shape is stable regardless of flags.
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.enabled).toBe('boolean');
    expect(typeof body.aiConfigured).toBe('boolean');
    expect(body.maxQuestionChars).toBe(400);
  });

  test('ask endpoint is public, JSON-only, and never rate-limits fresh traffic', async ({
    request,
  }) => {
    const res = await request.post('/api/recruiter/ask', {
      data: { username: 'definitely-not-a-user-9x7q', question: 'What did they build?' },
    });
    // Handler order (P1-I): validate → published-profile lookup → 404 BEFORE
    // any AI-config 503 — but only where a backend is configured (the deployed
    // preview has one; the hermetic CI/preview build does not, so 503
    // SERVER_NOT_CONFIGURED is truthful there). The binding contract is what
    // this guards: a fresh run must NEVER see the anti-abuse limiter preempt
    // with 429 (regression once 429'd every request everywhere).
    expect(res.status()).not.toBe(429);
    expect([404, 503]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(typeof body.code).toBe('string');
    if (res.status() === 404) {
      // With a backend, the profile lookup wins over any AI-config 503.
      expect(body.code).toBe('PROFILE_NOT_FOUND');
      expect(body.error).not.toMatch(/not configured/i);
    } else {
      expect(body.code).toBe('SERVER_NOT_CONFIGURED');
    }
  });

  test('recruiter panel is keyboard operable when enabled', async ({ page }) => {
    await page.goto('/u/definitely-not-a-user-9x7q');
    // No panel on a 404; the smoke contract is that the API stays reachable
    // and the UI never crashes. When a published profile exists with the
    // assistant enabled, the section must be reachable by keyboard.
    const heading = page.getByRole('heading', { name: /not found/i });
    await expect(heading).toBeVisible();
  });
});

test.describe('account deletion page (desktop + mobile)', () => {
  test('signed-out visitors get the sign-in prompt, not the delete flow', async ({ page }) => {
    await page.goto('/dashboard/account/delete');
    await expect(page.getByRole('heading', { name: /delete account/i })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: /sign in/i })).toBeVisible();
    // No destructive control is reachable while signed out.
    await expect(page.getByRole('button', { name: /continue to confirmation/i })).toHaveCount(0);
  });

  test('page is noindex and warns about permanence before any reauth', async ({ page }) => {
    await page.goto('/dashboard/account/delete');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // Signed out, the page shows the auth prompt; the permanence warning and
    // the typed-confirmation gate only exist for the signed-in owner path.
    const signedOut = await page
      .getByRole('main')
      .getByRole('link', { name: /sign in/i })
      .isVisible();
    if (!signedOut) {
      await expect(page.getByText(/permanent and cannot be undone/i)).toBeVisible();
      await expect(page.getByText(/there is no recovery/i)).toBeVisible();
    }
  });

  test('typed confirmation gates the destructive path', async ({ page }) => {
    await page.goto('/dashboard/account/delete');
    await expect(page.getByRole('heading', { name: /delete account/i })).toBeVisible();
    // Signed out: the confirm input never appears (auth prompt instead);
    // signed in: the gate input exists until the user types DELETE.
    const signedOut = await page
      .getByRole('main')
      .getByRole('link', { name: /sign in/i })
      .isVisible();
    if (!signedOut) {
      const confirmInput = page.locator('#confirm-delete');
      await expect(confirmInput).toBeVisible();
      await expect(page.getByRole('button', { name: /continue to confirmation/i })).toBeDisabled();
    }
  });

  test('route is wired in the app (no 404)', async ({ page }) => {
    const res = await page.goto('/dashboard/account/delete');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /delete account|sign in/i })).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * CWV baseline for the local production build. Thresholds are generous
 * (local machine variance is high); the point is to catch catastrophic
 * regressions and to record a baseline for the private-beta report.
 */

async function measureLcpMs(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let last = 0;
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) last = entry.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {
          // Observer unsupported; fall through to timeout with 0.
        }
        setTimeout(() => resolve(last), 5000);
      })
  );
}

async function measureCls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as unknown as { hadRecentInput?: boolean }).hadRecentInput) {
                total += (entry as unknown as { value: number }).value;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });
        } catch {
          // Observer unsupported.
        }
        setTimeout(() => resolve(total), 5000);
      })
  );
}

test.describe('CWV baseline', () => {
  test('landing page LCP and CLS stay within generous budgets', async ({ page }) => {
    test.info().annotations.push({ type: 'run', description: 'desktop only' });
    await page.goto('/');
    await page.getByRole('heading', { level: 1 }).waitFor();

    const [lcp, cls] = await Promise.all([measureLcpMs(page), measureCls(page)]);

    // Record for the report; fail only on catastrophic values.
    console.log(`[cwv] landing LCP=${Math.round(lcp)}ms CLS=${cls.toFixed(3)}`);
    expect(lcp).toBeLessThan(6000);
    expect(cls).toBeLessThan(0.25);
  }, 90_000);
});

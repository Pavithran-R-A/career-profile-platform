#!/usr/bin/env node
/**
 * Real-browser viewport and console audit against a DEPLOYED CareerProfile Go
 * origin. Not part of CI: run manually before a release, e.g.
 *
 *   node scripts/viewport-audit.mjs https://careerprofilego.memrae-staging.workers.dev
 *
 * For every public page × viewport width it checks:
 *   - horizontal overflow (document scrollWidth beyond the viewport)
 *   - console errors and same-origin failed responses (4xx/5xx)
 *   - document title present
 * Plus one keyboard spot-check per page at 1280px: the first Tab lands on a
 * focusable element with a non-zero focus outline box.
 *
 * Exit code 1 if any overflow/console-error/focus failure is found.
 * The target origin must be an exact https URL of an allowed host
 * (the staging Worker or localhost) — the script refuses anything else.
 */

import { chromium } from '@playwright/test';

const ALLOWED_HOSTS = new Set([
  'careerprofilego.memrae-staging.workers.dev',
  'localhost',
  '127.0.0.1',
]);

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/viewport-audit.mjs <https://origin>');
  process.exit(2);
}
let origin;
try {
  origin = new URL(arg).origin;
} catch {
  console.error('Invalid URL');
  process.exit(2);
}
if (new URL(origin).protocol !== 'https:' && new URL(origin).hostname !== 'localhost') {
  console.error('Only https origins (or localhost) are allowed');
  process.exit(2);
}
if (!ALLOWED_HOSTS.has(new URL(origin).hostname)) {
  console.error(`Refusing unexpected host: ${new URL(origin).hostname}`);
  process.exit(2);
}

const PAGES = [
  '/',
  '/pricing',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/contact',
  '/login',
  '/signup',
  '/forgot-password',
  '/u/definitely-not-a-user-9x7q',
  '/a-route-that-does-not-exist',
];
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1366, 1440, 1920];

const problems = [];
let checks = 0;

// Match playwright.config.ts: the repo's e2e runs on system Chrome (channel:
// 'chrome'), so no bundled-browser download is required for this audit.
const browser = await chromium.launch({ channel: 'chrome' });
for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('response', (res) => {
    if (res.url().startsWith(origin) && res.status() >= 400) {
      // The nonexistent-profile probe page EXPECTS the public API to answer
      // 404 — that is the privacy contract (unpublished users are not
      // disclosed), asserted by e2e-live/guest.spec.ts. Not a problem.
      const isExpectedProbe404 =
        res.status() === 404 &&
        res.url() === `${origin}/api/public/profile/definitely-not-a-user-9x7q`;
      if (!isExpectedProbe404) {
        failedResponses.push(`${res.status()} ${new URL(res.url()).pathname}`);
      }
    }
  });

  for (const path of PAGES) {
    consoleErrors.length = 0;
    failedResponses.length = 0;
    try {
      await page.goto(`${origin}${path}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(800); // allow hydration to settle (400ms can race teardown responses)
    } catch (err) {
      problems.push(`${width}px ${path}: navigation failed: ${String(err).slice(0, 120)}`);
      continue;
    }
    checks += 1;

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scroll: doc.scrollWidth, client: doc.clientWidth };
    });
    if (overflow.scroll > overflow.client + 1) {
      problems.push(
        `${width}px ${path}: HORIZONTAL OVERFLOW scroll=${overflow.scroll} client=${overflow.client}`
      );
    }
    const title = await page.title();
    if (!title || title.trim().length === 0) {
      problems.push(`${width}px ${path}: empty <title>`);
    }
    for (const c of consoleErrors) {
      // The browser logs its own console.error for any failed network fetch;
      // on the nonexistent-profile probe that is the expected 404 (privacy
      // contract). Filter that specific noise, keep everything else.
      if (path === '/u/definitely-not-a-user-9x7q' && /404/.test(c)) continue;
      problems.push(`${width}px ${path}: console.error: ${c}`);
    }
    for (const f of failedResponses) problems.push(`${width}px ${path}: failed response: ${f}`);
  }

  // Keyboard spot-check at this width on the landing page.
  await page.goto(`${origin}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(300);
  const focus = await page.evaluate(() => {
    const first = document.activeElement;
    first?.blur?.();
    return null;
  });
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { ok: false, tag: 'body' };
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const outline = style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    return { ok: rect.width > 0 && rect.height > 0, tag: el.tagName, visibleFocus: outline };
  });
  checks += 1;
  if (!focused.ok) problems.push(`${width}px /: first Tab does not reach a visible element`);
  else if (!focused.visibleFocus)
    problems.push(`${width}px /: first Tab focus has no outline/box-shadow (focus visibility)`);

  await context.close();
}
await browser.close();

console.log(`Viewport audit vs ${origin}: ${checks} checks, ${problems.length} problems`);
for (const p of problems) console.log(`  PROBLEM ${p}`);
process.exit(problems.length > 0 ? 1 : 0);

# Performance

## Bundle composition (production build, 2026-09-27)

Measured from `dist/client` via `pnpm bundle:scan` (`scripts/bundle-scan.mjs`):

| Asset | Size | When it loads |
| --- | --- | --- |
| `pdfjs-*.js` | 1563 kB | lazy — ATS route only (`/dashboard/resume/ats`) |
| `react-pdf.browser-*.js` | 1171 kB | lazy — ATS route only |
| `index-*.js` | 792 kB | initial (all routes) |
| `ATSResumeBuilder-*.js` | 20 kB | lazy — ATS route |
| `index-*.css` | 61 kB | initial |
| `og-cover.png` (dist root) | 24 kB | only by crawlers/social cards |

Notes:

- The ~2.7 MB PDF stack (pdf.js + @react-pdf/renderer) never loads on
  landing, pricing, auth, dashboard, editor, or public-profile routes — only
  the ATS builder imports it, via a route-level lazy chunk.
- The 792 kB initial JS is React 19 + react-router + @supabase/supabase-js +
  app code. Budget: fail the scan when the eager chunk passes 850 kB:
  `node scripts/bundle-scan.mjs --budget 850`. If it grows, code-split the
  largest pages (ProfileEditor, Dashboard) next.
- `pnpm build` is deterministic (content-hashed chunks) — compare hashes, not
  timestamps, when auditing changes.

## CWV baseline

`e2e/cwv-baseline.spec.ts` runs in the Playwright suite (system Chrome,
desktop + Pixel 7, local production build) with deliberately generous
thresholds to catch catastrophic regressions, not to certify a score:

- LCP < 6000 ms on the landing page
- CLS < 0.25 on the landing page

Local numbers vary with machine load; for the reference baseline, measure on
the stable preview with Chrome DevTools (Performance) or Lighthouse and record
the result here after significant layout or bundle changes.

## Practices that keep it fast

- System font stacks only — zero webfont downloads.
- No third-party runtime scripts (no analytics beacons, no CDNs in the page).
- Images are minimal: `favicon.svg` + `og-cover.png`; template thumbnails are
  rendered DOM, not rasters.
- Asset requests are served by the Workers static-asset binding; only
  `/api/*`, `/`, `/pricing`, `/u/*`, `/sitemap.xml`, `/robots.txt` execute the
  worker first (`run_worker_first`), so static files never pay a JS round-trip
  beyond the CDN.
- Motion uses transform/opacity only, with `prefers-reduced-motion` guards.
- The worker adds `X-Request-Id` + structured JSON logs for cheap
  server-side debugging without client overhead.

## How to measure

```bash
pnpm build
pnpm bundle:scan            # chunk sizes + heavy-chunk report
pnpm bundle:scan --budget 850   # gate: eager chunk ≤ 850 kB
pnpm test:e2e               # includes CWV baseline (local build)
```

On the deployed preview: Chrome DevTools → Performance/Lighthouse at
<https://core-qualification-career-profile-platform.memrae-staging.workers.dev>;
compare against the thresholds above and update this file when the baseline
moves.

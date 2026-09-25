# Production Readiness — Live Qualification Notes

Date: 2026-09-24 (UTC)
Constraints honored: Confirm Email left ON; no SUPABASE_SECRET_KEY requested; no `admin.createUser(email_confirm=true)` bypass; no repeated resends.

## Auth / Email Classification (per Dashboard confirmation)

- AUTH CONFIGURATION = PASS
  - Supabase Dashboard: CONFIRM EMAIL = ON (user-confirmed).
- VERIFY-EMAIL PAGE = PASS
  - App correctly reaches `/verify-email` after signup (user-confirmed).
- REAL EMAIL DELIVERY = BLOCKED BY BUILT-IN SUPABASE MAILER / NOT LIVE QUALIFIED
  - No confirmation email delivered in the observed attempt.
  - Built-in mailer limits (per current Supabase docs): ~2 auth emails/hour/project, team-address delivery limits, not intended for production.
  - No resend loop was run.

> CUSTOM SMTP REQUIRED BEFORE PUBLIC LAUNCH.

## Non-Email Qualification (code + automated, not live-browser)

Live-browser bridge was unavailable in this environment, so no item below is marked as live-browser PASS:

- `kimi-webbridge` binary missing (`%USERPROFILE%\.kimi-webbridge\bin\kimi-webbridge.exe` = False).
- Daemon port `127.0.0.1:10086` = TcpTestSucceeded False.
- Dev server `127.0.0.1:5173` = TcpTestSucceeded False.
- To run true browser qualification, install/connect the bridge: https://www.kimi.com/features/webbridge, start dev server (`pnpm dev`), then re-run the six items.

### 1. ATS PDF live generation — CODE PASS, BROWSER NOT OBSERVED

- Route present (uncommitted): `/dashboard/resume/ats` → `ATSResumeBuilder` in `src/App.tsx:39`.
- Export path is real PDF generation, not print:
  - `src/pages/ATSResumeBuilder.tsx:183-212` builds `toATSExportModel(...)` → `generatePDFBlob(model)` → object-URL anchor download `${username}-resume.pdf`.
  - Contact email/phone are explicit optional inputs; auth email is never injected (`src/lib/resume/ats-export.ts:21-22`).
- Tests: `ats-export.test.ts` + `ats-view-model.test.ts` + `pdf-renderer.test.ts` + `ats-export-parseback.test.ts` = 58 passed.
- Gap: no Dashboard link points to `/dashboard/resume/ats`; reachable only by direct URL. `JobTailoring.tsx:287` still navigates to non-existent `/dashboard/ats`.

### 2. Actual PDF download + unpdf parseback — BYTE PASS, BROWSER CLICK NOT OBSERVED

- `src/tests/unit/ats-export-parseback.test.ts` (node env) proves real bytes:
  - `%PDF-` magic header asserted.
  - `unpdf` `getDocumentProxy` + `extractText` round-trip asserts reading order: Synthetic Candidate → SUMMARY → EXPERIENCE → EDUCATION → SKILLS → PROJECTS.
  - Multi-page case asserts `numPages > 1` and first/last entries survive.
  - Asserts no invented auth email.
- What remains for live qualification: click Export in a real browser, capture the downloaded file, re-parse with `unpdf`.

### 3–5. Minimal / Editorial / Technical portfolios — CODE PRESENT, NOT LIVE QUALIFIED

- Components exist:
  - `src/components/templates/MinimalTemplate.tsx`
  - `src/components/templates/EditorialTemplate.tsx`
  - `src/components/templates/TechnicalTemplate.tsx`
- Supporting tests pass: `preferences` + `template` + `public-dto` + `publishing` = 64 passed; `pnpm typecheck` clean; `pnpm build` clean.
- Blockers found (do not launch public portfolios until fixed):
  - Template registry empty at runtime: `registerTemplate` defined in `src/lib/templates/types.ts:46` but never called; `TemplateSelector` will render “No templates available.”
  - Templates are never rendered by any route (no imports of the three components outside their own files).
  - `PublicProfile`, `DashboardPreview`, `JobTailoring` pages exist but have no routes in `src/App.tsx`.
  - Appearance default `template_key: 'classic'` has no matching registered template.

### 6. Responsive checks — CODE MARKERS ONLY, LIVE VIEWPORTS NOT OBSERVED

- `EditorialTemplate.tsx:186`: `grid grid-cols-1 md:grid-cols-[280px_1fr]` (single → sidebar).
- `MinimalTemplate.tsx:159` (`max-w-3xl`), `TechnicalTemplate.tsx:178` (`max-w-4xl`), `ATSPreview.tsx:40` (`max-w-[8.5in]`) are fluid/centered but have no breakpoint switching.
- `TemplateSelector.tsx:22`: `grid-cols-1 sm:grid-cols-3`.
- What remains: 390px / 768px / 1280px viewport screenshots + no-horizontal-scroll + sidebar collapse check in a live browser.

## Build / Type Safety

- `pnpm typecheck` (tsc --noEmit): PASS.
- `pnpm build` (tsc -b + vite build client + worker): PASS (chunk-size warnings only).

## Launch Gates

1. Configure custom SMTP in Supabase Auth and re-test delivery to a non-team inbox.
2. ~~Wire template registry + public routes (`/u/:username`, preview) before advertising portfolios.~~ DONE 2026-09-24 (routing closure below).
3. ~~Fix `/dashboard/ats` → `/dashboard/resume/ats` link and add ATS entry point to Dashboard.~~ DONE 2026-09-24.
4. Re-run the six browser items with the bridge connected; do not mark them PASS from code alone.

## Authenticated Walkthrough (2026-09-24, live preview, Playwright + Chrome)

Account `pavithran` (email-confirmed by user). All steps executed live:

- Login → dashboard. Onboarding already complete; new-account flow covered by
  `onboarding.test.tsx` (persists basics).
- Basics update (display name/headline) saved; completion rose 0% → 60%,
  then 100% once skills/links were added (truthful count, no inflation).
- Profile edit: 12 experiences, 1 education, 2 projects, 3 skills, 2 links.
- Appearance: Minimal/Editorial/Technical each selected + previewed
  (screenshots), accent switched to emerald.
- Owner preview renders all entered data.
- Publish → anonymous `/u/pavithran` visible; unpublish → unavailable;
  republish → available. `PublishControls` is now wired into the Dashboard
  status card (it existed but was mounted nowhere).
- Resume upload: fixed three stacked defects found live —
  (1) literal `'current'` as profile_id, (2) sessionless service client
  (401 on storage), (3) missing Bearer + wrong `storagePath` contract vs
  the worker's `resumeSourceId` API. Worker `verifyAuth` now falls back to
  the `VITE_` env names this deployment provides, and extraction runs as
  the user (RLS-scoped, no service key needed). Preview deploys must pass
  `--secrets-file .env.local` so the worker sees the public Supabase vars.
- Extraction endpoint correctly returns 503 `AI extraction is not
configured` (no provider key in preview env); UI shows a truthful
  "Resume saved / extraction unavailable" state instead of a failure.
- ATS: preview generated with explicit contact info, real browser download
  (`pavithran-resume.pdf`, 3728 bytes), parsed with unpdf: `%PDF-`,
  2 pages (multi-page from 12 experiences), 2032 selectable chars, correct
  section order, no invented data.
- Console/network: no 500s, no raw backend text in UI; only expected
  401→fixed and 503-unconfigured responses during the debugging loop.

## Product Design Closure (2026-09-24, third pass)

Base MVP is now a credible career product, verified with a Playwright +
system-Chrome harness (7 viewports, oklab/lab-aware WCAG checker, tap,
overflow, console and network audits):

- Messaging: headline is now "One profile. Built for recruiters." with a
  CV → profile → ATS → portfolio story. No "verified" claims, no GitHub or
  AI capability mentions while those integrations stay disabled.
- Brand: ink-navy + blue identity, ascending-bars mark (favicon, header,
  dashboard thumbnail), display/lead/eyebrow type scale, token radii and
  shadows, reduced-motion support.
- Landing: hero with real rendered product panel (flow chips + mini
  portfolio card), 3-step story, recruiter-scan band, full example
  portfolio in a browser frame (real Minimal template output on a
  fictional persona), final CTA. Auth-aware CTAs, "See an example" anchor.
- Dashboard: completion rows carry truthful details ("12 entries",
  "3 skills" — no repeated "5/5"); published hero shows live URL with Open
  - Copy link + mini thumbnail; draft hero has Finish/Preview next
    actions; icon-led action groups.
- Editor: mobile tab bar, skeleton loading, aria-live success, guided
  basics fields, month selects + current-role disabling, inline editing
  for experience/education/projects/links, subtle icon delete with
  confirm, move controls, richer project cards, accessible skill chips,
  explanatory empty states for every section.
- Templates: shared `formatDateRange`/`LinkIcon` helpers; Minimal is a
  typography-led personal page (dated grid, project cards, show-more
  past 5 roles); Editorial is sidebar-composed with numbered rhythm and
  serif display; Technical is dark metadata-led with repo cards and mono
  details (no terminal clichés). Legacy "about" order key normalized so
  older preference rows still render.
- Public portfolio: anonymous `/u/:username` now renders the saved
  template via an extended anon-safe view (relations + preferences as
  aggregates; still published-only, still no user_id). Verified live for
  all three templates.
- Appearance: structural mini-thumbnails per template, live preview
  already reflects every save; badges fixed to AA contrast.
- Resume/ATS: idle "what happens next" steps, honest saved-state copy,
  ATS builder with a real inclusion summary (counts, never a fake score).
- ATS route is lazy-loaded; initial bundle excludes the ~2.7 MB PDF libs.
- Contrast: oklab/lab-aware audit across 11 routes — zero violations
  (fixed white/40-45 labels on dark surfaces, gray-400 microcopy, badge
  colors). Verified zero overflow on 7 viewports, zero console errors,
  zero failed requests, AA keyboard/focus/labels/tap targets.

## Base MVP Live UI/UX Closure (2026-09-24, second pass)

Critical defects fixed and browser-verified with Playwright + system Chrome
(Kimi bridge required human login/pairing, so Playwright was used instead):

- Resume UUID "current": `ResumeImport` passed the literal `'current'` as
  `profile_id` into the uuid column. Now resolves the canonical owned
  profile via `ProfileService.getProfile` (onboarding redirect when absent),
  plus `assertProfileId` guard in `ResumeService.uploadResume` and
  customer-safe error mapping (`src/lib/resume/errors.ts`). Raw Postgres
  text can no longer reach the UI.
- Anonymous public profiles were 401-broken: anon has no grant on
  `profiles`. Lookups now read the anon-safe `public_profiles` view, and the
  schema accepts Supabase `+00:00` timestamp offsets (zod v4 `datetime`
  rejects them by default — this silently broke every real public profile).
  `.maybeSingle()` removes console-error noise for missing users.
- Completion 0%: onboarding never persisted display name/headline/about/
  location. Now saved via `updateProfile`; shared `profileCompletion`
  helper drives the Dashboard (with progress bar, skeleton loading state).
- Logged-out loading loops fixed on Dashboard/ProfileEditor/ATS builder
  (spinner forever → redirect to login, browser-verified).
- Visual system: single light theme (the dark `prefers-color-scheme` block
  mixed with hardcoded light components caused the invisible-text cards),
  central tokens + button/input/card/alert/chip/skeleton classes in
  `src/index.css`; polished header (brand, core nav, mobile menu, billing
  moved to footer), redesigned Dashboard (completion hero, status card,
  grouped actions, public-URL banner), landing, onboarding progress steps,
  Appearance live template preview, 404 heading fix, global focus-visible
  ring.
- Browser-verified (Playwright, real Chrome): 6 public routes × 5 viewports
  (1440x900, 1280x720, 768x1024, 390x844, 360x800), zero horizontal
  overflow, zero console errors, zero failed requests; mobile menu
  open/close with no off-screen links; logical tab order; focus ring on
  `:focus-visible`; zero sub-4.5 contrast samples; native form validation;
  live preview `/u/qual-1790169841172` renders anonymously.
- Gates: format / lint (0 warnings) / typecheck / 540 tests / build /
  `pnpm audit` clean. Full suite needs `--maxWorkers=2` on this machine
  (parallel workers OOM otherwise — environmental, not a code issue).
- Human-gated remainder: end-to-end authenticated walkthrough (signup hits
  `/verify-email` as designed; Supabase rejects reserved domains like
  example.com; clicking the confirmation link needs a real inbox).

## Routing + Template Closure (2026-09-24)

- Canonical routes registered in `src/App.tsx` (`AppRoutes` exported for tests):
  `/dashboard/resume/ats`, `/dashboard/resume/tailor` (JobTailoring),
  `/dashboard/preview` (owner, drafts allowed), `/dashboard/github`,
  `/u/:username` (public, published-only via query filter),
  `/dashboard/ats` → deliberate redirect to `/dashboard/resume/ats`.
- Dead link fixed: `JobTailoring.tsx` now navigates to `/dashboard/resume/ats`.
- Template registry root cause: `registerTemplate` was never called.
  Fix: explicit `src/lib/templates/registry.ts` (metadata + config + component
  mapping in one module) initialized from `src/main.tsx`; fallback
  `template_key` values aligned to `minimal`. Selector reads the registry,
  so "No templates available." cannot appear in the configured app state.
- Dashboard discoverability: ATS resume, Job tailoring, Portfolio preview,
  Appearance actions added; footer shows live `/u/:username` link when
  published, draft notice otherwise.
- Route security preserved: dashboard pages keep in-page auth + onboarding
  guards; `/u/:username` filters `visibility = published`; unknown paths hit
  `NotFound`; unknown `/api/*` returns JSON 404 (worker handler fallback).
- JobTailoring is fully client-side (no BharatCode dependency), so no
  not-configured state was needed; Billing/Domains keep their existing
  truthful disabled UX.
- Gates: format / lint / typecheck / 524 tests / build / `pnpm audit` all clean.
- Preview updated in place: https://core-qualification-career-profile-platform.memrae-staging.workers.dev

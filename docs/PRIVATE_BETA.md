# Private Beta

Status: in progress (as of 2026-09-27).
Stable preview: <https://core-qualification-career-profile-platform.memrae-staging.workers.dev>

Joining: sign up at the preview URL with a real email inbox (email confirmation
is ON — Supabase rejects reserved domains such as `example.com`).

## What works in the beta

- Email/password auth: signup, confirm email, sign in, password reset.
- Onboarding, then the full profile editor: basics, experience, education,
  projects, skills, links — with validation and a truthful completion meter.
- CV import: PDF upload tied to your profile. Automatic extraction runs when an
  AI key is configured (see below); without it the UI shows a truthful
  "Resume saved / extraction unavailable" state.
- ATS resume builder: real multi-page PDF generation and download
  (letter/8.5in layout, explicit optional contact fields — the auth email is
  never injected).
- Job tailoring: client-side analysis of a job description against your
  profile evidence (no AI required).
- Appearance studio: Minimal / Editorial / Technical templates, accent color,
  live preview, persisted per user.
- Public portfolio at `/u/<username>`: publish/unpublish, anonymous read via
  the `public_profiles` view (published data only, no `user_id` exposure).
- Recruiter AI: `POST /api/recruiter/ask` answers strictly from the published
  profile (grounding + truncation + sanitization), IP-rate-limited
  (30/min), and returns the profile sections it used. The recruiter Q&A
  panel now ships on public profiles: suggested questions, grounded answers,
  and "Based on" section citations. It renders only when the deployment has
  `RECRUITER_AI_ENABLED` on and the AI key configured; otherwise it stays
  hidden. `GET /api/recruiter/config` is the public, non-secret flag feed.
- SEO: `sitemap.xml`, `robots.txt`, per-page meta (OG/Twitter/canonical),
  ProfilePage JSON-LD, OG cover image.
- Privacy-safe funnel analytics: `signup_started → signup_completed →
profile_created → resume_uploaded → profile_completed → ats_generated →
ats_downloaded`, plus `profile_updated`. No PII in events; allowlisted names;
  metadata sanitized.

## Plans (server-authoritative pricing)

|                              | Free | Pro (one-time annual) |
| ---------------------------- | ---- | --------------------- |
| ATS resume variants          | 3    | 20                    |
| Recruiter AI questions / day | 10   | 100                   |
| Deterministic job tailoring  | Unlimited | Unlimited        |
| GitHub repos (selected)      | 5    | 20                    |
| Custom domains               | 0    | 1                     |

All paid-feature quotas are enforced server-side (usage RPC / worker
endpoints), not just in the UI. There is no branding-removal entitlement;
the platform mark is part of every public portfolio.

Price authority is the worker (`PRO_ANNUAL_PRICE_PAISE`, default ₹1,999/yr);
the client never sets amounts.

## Intentionally limited or disabled in the beta

- **AI features** (CV extraction, recruiter AI answers) require
  `BHARATCODE_API_KEY` on the deployment. Until it is set, the relevant
  routes answer 503 `AI extraction is not configured` and the UI degrades
  honestly instead of failing.
- **Email delivery** uses the Supabase built-in mailer (rate-limited,
  not production-grade). Custom SMTP is a launch gate — see
  `docs/PRODUCTION_READINESS.md`.
- **Billing (Razorpay), GitHub integration, custom domains, `.cv` domains**:
  code paths exist but are unconfigured; the UI shows truthful disabled states.
- No teams/organizations, no third-party API access (public pages only).
  Account deletion exists: `/dashboard/account/delete` (typed confirmation,
  fresh re-auth via verified JWT claims within 10 minutes, storage-first
  cleanup including orphaned objects, server-only auth admin delete,
  sign-out + redirect). Billing: Pro is ONE-TIME ANNUAL ACCESS (no automatic
  renewal, no cancel/resume — legacy endpoints answer 410); live payments
  still await production credentials.

## What we need from beta users

1. What breaks, what confuses, what is missing — report via repo issues
   (include the route and, when relevant, a screenshot-free description of
   what you expected vs. what happened).
2. Extraction quality feedback: upload a real (anonymized) CV and tell us
   once the AI key is live what the parsed draft missed.
3. Recruiter personas: read public profiles and try `/api/recruiter/ask`
   (curl or a client) — flag any answer that is not grounded in the profile.

## Known limitations (accepted for beta)

- Navigation collapses into a menu below 1024px (intended responsive behavior).
- The initial JS bundle is ~790 kB (React 19 + router + supabase-js + app);
  the ~2.7 MB PDF stack is lazy-loaded only on the ATS route — see
  `docs/PERFORMANCE.md`.
- Local full-test runs on Windows need `npx vitest run --maxWorkers=2`
  (parallel workers OOM on the dev machine; environmental, not a code issue).

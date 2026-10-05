# CareerProfile Go Roadmap

This file separates **product implementation** from **production launch configuration**.
A checked product item means the capability exists in the repository; it does not by itself
mean that an external provider, paid integration, or final public domain is live.

## Stage 0 — Foundation

- [x] React/TypeScript/Vite application scaffold and tooling
- [x] Canonical career-profile types and validation
- [x] Username policy and profile routing
- [x] Supabase schema with row-level security
- [x] AI-provider abstraction
- [x] Cloudflare Worker API boundary
- [x] Architecture, security, data-model, and release documentation

## Stage 1 — Authentication + Career Profile

- [x] Email/password authentication
- [x] Email-verification flow
- [x] Password-reset flow
- [x] Strong client-side password policy
- [x] Profile creation and editing
- [x] Experience, education, projects, skills, links, and achievements
- [x] Publish/draft controls
- [x] Account deletion flow
- [ ] Production SMTP / branded sender configured
- [ ] Supabase leaked-password protection enabled

## Stage 2 — Resume Ingestion

- [x] Resume/PDF upload and private storage
- [x] Server-side text extraction/parsing boundary
- [x] Structured profile extraction
- [x] Manual review/correction flow
- [x] Resume-source persistence and ownership controls

## Stage 3 — Portfolio + Publishing

- [x] Public profile rendering
- [x] Published-only server-side projection boundary
- [x] Multiple portfolio templates
- [x] Appearance controls and responsive layouts
- [x] Sharing controls
- [x] Search metadata, sitemap, robots, canonical URLs, Open Graph, and JSON-LD
- [ ] Final production domain and username subdomain routing configured

## Stage 4 — GitHub Integration

- [x] GitHub App installation flow
- [x] Repository synchronization
- [x] Repository selection and public-evidence controls
- [x] Language/technology and repository evidence model
- [x] Signed installation state and server-side credential handling
- [ ] Production GitHub App credentials configured and live-smoke-tested if enabled at launch

## Stage 5 — Recruiter AI

- [x] Recruiter-facing question interface
- [x] Answers grounded in published career/profile data
- [x] Public-content-only data boundary
- [x] Product quotas and Worker-side rate limiting
- [x] Provider abstraction and fail-closed feature flag
- [ ] Production AI-provider credentials configured and live-smoke-tested if enabled at launch

## Stage 6 — ATS Resume + Job Tailoring

- [x] ATS-oriented resume builder
- [x] PDF resume rendering/export
- [x] Job-description analysis
- [x] Job-specific profile/resume variants
- [x] Tailoring review flow and keyword guidance

## Stage 7 — Billing + Domains

- [x] Free/Pro entitlement policy
- [x] Usage counters and quotas
- [x] Razorpay order creation with server-authoritative pricing
- [x] Webhook signature verification and idempotency
- [x] One-time annual Pro access model (no automatic renewal)
- [x] Pricing and billing UI
- [x] Custom-domain data model and Cloudflare-for-SaaS adapter
- [x] Optional .CV provider adapter, disabled by default
- [ ] Production Razorpay credentials and real-payment smoke test if billing is enabled at launch
- [ ] Production custom-domain credentials and real-domain smoke test if domains are enabled at launch

## Stage 8 — Quality, Security + Real-User Validation

- [x] Unit test suite
- [x] Playwright desktop/mobile E2E suite
- [x] Production dependency audit
- [x] Bundle-budget check
- [x] Security headers and per-response CSP nonce
- [x] Database security hardening and least-privilege public projections
- [x] First-party funnel/product event model
- [x] CareerProfile Go rebrand CI green on the final release head
- [ ] Final live signup → verify → reset-password → account-delete smoke suite
- [ ] Enabled optional integrations live-smoke-tested
- [ ] Real-user beta/launch feedback pass

## Stage 9 — Production Launch

- [x] CareerProfile Go brand, canonical entity name, favicon/logo, SEO/AEO/GEO copy
- [x] Privacy Policy, Terms of Service, Refund & Cancellation Policy, and Contact routes
- [x] Production Worker release runbook
- [ ] Final support email/operator details configured
- [ ] Final public domain selected
- [ ] DNS / Cloudflare routes configured
- [ ] Supabase Site URL and redirect allow-list updated to the final domain
- [ ] Final-domain deployment from the exact green release commit
- [ ] Search-engine launch checks on robots.txt, sitemap.xml, canonicals, structured data, and social preview
- [ ] Merge release branch to `master` and tag the public release

## Release rule

Do not call CareerProfile Go **100% public-live** until every applicable unchecked item in
Stages 1, 3–5, 7–9 has either passed or is deliberately disabled/fail-closed for launch.
The public domain remains the final infrastructure decision, after the code release candidate is green.

# Email Production Configuration Checklist

> Scope: the dedicated sender for **auth transactional email** (signup
> confirmation, password reset). Validated 2026-10-17 against build
> `1c9e4e9`.
>
> **No production Auth setting has been changed by the agent, and none should
> be changed without the owner's explicit go-ahead.** Everything below is
> owner-executed configuration, not code.

## What the app actually does today (verified, mocked — no live send)

The client-side flow is validated end-to-end in
`src/tests/unit/email-auth-flows.test.tsx` (20 tests, all green) against a
mocked Supabase Auth client:

| Flow                   | Validated behaviour                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signup                 | `signUp` carries `emailRedirectTo = {origin}/auth/callback`; mismatched/weak passwords rejected pre-network; provider error surfaces safely.                                             |
| Resend confirmation    | **New.** `supabase.auth.resend({ type:'signup', email })` with explicit success/failure feedback. Address comes from signup `location.state` or a pending session; never guessed.        |
| Verify email           | Never a silent no-op: one of "not yet", "verified → dashboard", or a safe alert is always shown.                                                                                         |
| Password reset request | `resetPasswordForEmail(email, { redirectTo: {origin}/reset-password })`; truthful "Check your email" naming the address.                                                                 |
| Reset link expiry      | No recovery session → invalid/expired state with "Request a new reset link"; expired JWT on update → sanitised message.                                                                  |
| Reset completion       | Requires a recovery session (QA-003); weak/mismatch rejected pre-network; success → "Password updated".                                                                                  |
| Auth callback          | `?error=` shows description; `token_hash`+`type` verified; confirmed+no profile → `/onboarding`; confirmed+profile → `/dashboard`; unconfirmed → `/verify-email`.                        |
| Error sanitisation     | **New fix.** `Login`, `Signup`, `ForgotPassword` now route provider text through `toSafeAuthMessage` — they previously rendered raw `authError.message` (e.g. `Invalid JWT: pgrst-000`). |

Because Supabase Auth performs the actual send, **real delivery cannot be
proven from this repository.** The gap is entirely provider/DNS
configuration, which is owner-held.

## Recommended sender: Postmark

Picked for a transactional-only auth workload that must hand **raw SMTP
credentials** to Supabase Auth (`Authentication → Emails → SMTP Settings`),
not an SDK token. Sources: [Postmark SMTP service](https://postmarkapp.com/smtp-service),
[send-with-SMTP](https://postmarkapp.com/developer/user-guide/send-email-with-smtp),
[Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

- Publishes standard SMTP (`smtp.postmarkapp.com:587`, STARTTLS), so it drops
  straight into Supabase's SMTP fields.
- Auth uses the **Server API Token for both username and password** — one
  secret, no separate SMTP user to invent.
- Dedicated **Message Stream** (e.g. `auth-transactional`) keeps signup/reset
  traffic isolated from any future marketing stream, protecting reputation.
- 100 emails/month free tier is ample for private beta auth volume.

Alternatives that also expose real SMTP: AWS SES (cheapest at volume, more
setup), Mailgun, Brevo, Elastic Email. Rejected for this workload: Knock
(orchestration layer over another provider — an extra hop and secret, not a
sender).

## Prepared alternative: Resend (dedicated DNS + SMTP settings ready to apply)

Researched 2026-10-18 against Resend's official docs — sources:
[Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp),
[SMTP guide](https://resend.com/docs/send-with-smtp),
[add & verify a domain](https://resend.com/docs/add-a-domain),
[DNS guide example](https://resend.com/docs/guides/dns/namecheap),
[DMARC](https://resend.com/docs/dashboard/domains/dmarc),
[quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits).
Owner picks Resend **or** Postmark below; nothing here has been activated.

### Supabase Auth → Emails → SMTP Settings (Resend values)

| Field    | Value                                                         |
| -------- | ------------------------------------------------------------- |
| Sender   | `CareerProfile Go <no-reply@yourdomain>`                      |
| Host     | `smtp.resend.com`                                             |
| Port     | `465` (implicit TLS — the port Resend documents for Supabase) |
| User     | `resend` (literally)                                          |
| Password | Resend **API key** (`re_…`), not the account password         |

### DNS records to publish on the chosen sender domain

Copy the final values from Resend's domain **Records** tab (they are generated
per domain/region); the documented shape is:

| Purpose                                            | Type | Host                | Value                                                   |
| -------------------------------------------------- | ---- | ------------------- | ------------------------------------------------------- |
| DKIM                                               | TXT  | `resend._domainkey` | `p=<Resend-generated public key>`                       |
| SPF                                                | TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                     |
| Bounce/feedback MX                                 | MX   | `send`              | `feedback-smtp.<region>.amazonses.com` (priority 10)    |
| DMARC (recommended, not required for verification) | TXT  | `_dmarc`            | `v=DMARC1; p=none; rua=mailto:dmarcreports@yourdomain;` |

- Merge SPF into an existing apex SPF TXT — never two SPF records.
- Start DMARC at `p=none`, tighten to `p=quarantine` after a clean week.
- Resend recommends (doesn't require) a sending subdomain such as
  `notifications@yourdomain`; each subdomain verifies separately.
  `onboarding@resend.dev` is test-only (owner-address recipients) — never launch on it.

### Limits to budget

- Resend Free: **100/day, 3,000/month** transactional emails, 3 domains;
  SMTP rate limit matches API (10 req/s per team).
- Supabase Auth with custom SMTP defaults to **25 emails/hour** — raise this
  in Auth settings (owner action) before public signup.

## Owner checklist

### 1. Domain

- [ ] Own a root/apex domain for the product (the current
      `careerprofilego.memrae-staging.workers.dev` is Cloudflare's staging
      host, **not** a sender domain, and must not be used as one).
- [ ] Decide the From address. Supabase's default is
      `no-reply@supabase.co`; overwrite it. Use the same domain the app is
      hosted on where possible. Suggested:
      `CareerProfile Go <no-reply@yourdomain>` and support address
      `support@yourdomain`.
- [ ] Do **not** reuse any domain or credential belonging to another project.

### 2. Postmark

- [ ] Create account → **Servers** → new server → **Message Streams** →
      create stream `auth-transactional` (type: Outbound).
- [ ] **Sender Signatures**: add `no-reply@yourdomain`. If the domain isn't
      DNS-verified yet Postmark issues a temporary
      `@pmapi.com` signature — that is fine only for the verification email,
      never for launch.
- [ ] Copy the **Server API Token** (used as both SMTP username and password).

### 3. DNS (on `yourdomain`)

- [ ] **DKIM**: add the CNAME records Postmark shows (typically
      `pm._domainkey`, plus the tracking CNAMEs if enabled).
- [ ] **SPF**: add the TXT record authorising Postmark's senders. If the apex
      already has an SPF record, **merge** the `include:` — never add a second
      SPF TXT record (multiple SPF records fail validation outright).
- [ ] **DMARC**: start permissive and tighten once volume flows:
      `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain; pct=100`.
      Move to `p=quarantine` after a clean week.
- [ ] Verify each record in Postmark until the signature shows **Verified**.
- [ ] MX on the apex must exist if you point `rua=` at the same domain.

### 4. Supabase Auth SMTP (Authentication → Emails → SMTP Settings)

- [ ] **Enable SMTP** and paste:

      | Field      | Value                                                 |
      | ---------- | ----------------------------------------------------- |
      | Sender     | `CareerProfile Go <no-reply@yourdomain>`              |
      | Host       | `smtp.postmarkapp.com`                                |
      | Port       | `587` (STARTTLS)                                      |
      | User       | `<Server API Token>`                                  |
      | Password   | `<Server API Token>` (same value)                     |
      | Min interval | 60s (default) is fine for auth traffic              |

- [ ] **Enable email confirmations** on the provider if not already on.
- [ ] Set **OTP expiry** to ≤ 3600s (Supabase recommends 1h or lower). The
      app's invalid/expired paths are tested; a long expiry only widens the
      window for a leaked link.
- [ ] Check the auth **rate limit**: with custom SMTP Supabase defaults to
      **30 new users/hour**. Raise this before any public launch, or signup
      will start returning rate errors the app surfaces as a safe alert.

### 5. Templates (Authentication → Email Templates)

Confirm each template the app's tested flows rely on:

- [ ] **Confirm signup** — button target must be `{{ .ConfirmationURL }}`
      (the app handles it at `/auth/callback?token_hash=…&type=signup`).
- [ ] **Reset password** — `{{ .ConfirmationURL }}` (lands on
      `/reset-password?…` → recovery session).
- [ ] **Change email address** — if enabled later.
- [ ] **Magic Link** — only if magic-link sign-in is ever enabled; the
      callback already accepts `type=magiclink`.
- [ ] Keep templates plain and link-forward; no images in the header (spam
      signals), and state the action in the first line.

### 6. App-side URLs (no code change needed)

Code-side state verified at `1ab65ee`: signup sends
`emailRedirectTo = {origin}/auth/callback` (`src/pages/auth/Signup.tsx:41`,
fallback in `src/lib/auth/context.tsx:71`), reset sends
`redirectTo = {origin}/reset-password` (`context.tsx:93-94`), resend uses
`{ type: 'signup' }` (`VerifyEmail.tsx:113`), and the callback verifies
`token_hash` + `type` before routing (`AuthCallback.tsx`). All are built from
`window.location.origin`, so the deployed origin must be allow-listed:

- [ ] Set Supabase **Site URL** to the canonical production origin, and add
      `/auth/callback` + `/reset-password` as **Redirect URLs**. The app
      builds these from `window.location.origin`, so the deployed origin must
      be allow-listed or Supabase silently drops the redirect.
- [ ] Set `VITE_SUPPORT_EMAIL` in the build env and rebuild so Contact /
      Privacy / Terms / Refund show the real support address
      (`docs/PRODUCTION_DEPLOYMENT.md` §required variables).

### 7. Post-change verification (owner or agent, with the live sender)

- [ ] Sign up with a real mailbox → confirmation arrives, link works,
      `/onboarding` reached.
- [ ] Click **Resend confirmation email** on `/verify-email` → second mail
      arrives; a second rapid click shows the safe rate-limit alert.
- [ ] Request a reset → link opens `/reset-password` with the form; an old
      link shows the invalid/expired state.
- [ ] Check Postmark's **Activity** for each message; confirm no DMARC
      failures in the `rua=` reports.
- [ ] Confirm the SPF/DKIM/DMARC alignment with a header check on a received
      message.

## Blocker note

Real delivery, template rendering, and rate-limit thresholds stay
**unverified** because they require the owner's Postmark account, DNS access,
and Supabase dashboard. Nothing above was executed by the agent; no production
Auth setting was modified.

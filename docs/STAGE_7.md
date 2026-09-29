# Stage 7: Monetization, Entitlements & Domains

## Overview

Stage 7 introduces paid plans (Free / Pro), server-side billing with Razorpay, usage quotas, custom domain support via Cloudflare for SaaS, and a disabled-by-default .cv domain provider integration.

**Constraints honored in this pass:**

- Implementation-first, no live money movement
- No live domain registration or purchase
- No `VITE_`-prefixed secrets
- Razorpay: Orders + Checkout only (no subscriptions API)
- Server-side amount authority for order creation
- Raw-body webhook HMAC verification with event-id idempotency
- Platform wildcard `username.OURDOMAIN.com` architecture only — no domain purchased

## Architecture

### Product Plans & Entitlements

| Module       | File                              | Responsibility                                    |
| ------------ | --------------------------------- | ------------------------------------------------- |
| Plans        | `src/lib/billing/plans.ts`        | FREE/PRO limits, public plan cards, price parsing |
| Entitlements | `src/lib/billing/entitlements.ts` | Subscription state → active plan resolution       |
| Usage        | `src/lib/billing/usage.ts`        | Windowed counters (day/month/total), quota checks |
| Orders       | `src/lib/billing/orders.ts`       | Local order state machine                         |

### Canonical Limits

| Metric                       | Free      | Pro  |
| ---------------------------- | --------- | ---- |
| Resume variants (RPC)        | 3         | 20   |
| GitHub repos (selected)      | 5         | 20   |
| Recruiter AI / day (RPC)     | 10        | 100  |
| Deterministic job tailoring  | Unlimited | Unlimited |
| Custom domains               | 0         | 1    |

Every metered quota is enforced server-side: variant creation through the
`create_profile_variant` RPC (the direct client INSERT policy was removed),
recruiter AI through `consume_recruiter_quota`, repo selection and custom
domains in the worker endpoints. There is no branding-removal entitlement.

### Billing Flow (ONE-TIME ANNUAL PRO ACCESS)

There is no subscription and no automatic renewal: a payment grants one
year of Pro. Paying again while active extends from
`max(now, current_period_end)` + 1 year — existing access is never
shortened. Legacy `cancel`/`resume` routes answer 410 and the
`cancel_at_period_end` column is retained as unused schema.

```
Client (/dashboard/billing)
  → POST /api/billing/order (auth)
  → Server creates Razorpay order (amount from PRO_ANNUAL_PRICE_PAISE)
  → Server inserts billing_orders (status=created)
  → Returns { razorpayOrderId, amountPaise, keyId }
  → Client opens Razorpay Checkout
  → Razorpay sends webhook → POST /api/billing/webhook
  → Verify HMAC(raw body, RAZORPAY_WEBHOOK_SECRET)
  → Idempotent claim on x-razorpay-event-id
  → Mark order paid + activate user_subscriptions (pro, period_end = +1 year)
```

### Webhook Security

1. Verify `x-razorpay-signature` against raw body with `RAZORPAY_WEBHOOK_SECRET`
2. Extract `x-razorpay-event-id` for idempotency (insert into `billing_webhook_events`, conflict = skip)
3. Only process `payment.captured` and `order.paid`
4. Activate subscription only after order row is marked paid

## Database

### Billing Tables (`20260921000000_stage7_billing.sql`)

- **user_subscriptions** — plan, status, period; RLS: owner SELECT only (server writes)
- **billing_orders** — amount, status, razorpay IDs; RLS: owner SELECT only
- **billing_webhook_events** — event_id PK for idempotency; no client access
- **usage_counters** — (user_id, metric, window_key) PK; RLS: owner SELECT only

### Domain Tables (`20260921010000_stage7_domains.sql`)

- **custom_domains** — hostname, status, verification token, cloudflare ID; owner RLS
- **dotcv_domains** — label, status, provider reference, quote price; owner RLS

## Domains

### Custom Domains (Cloudflare for SaaS)

| Module     | File                            | Responsibility                         |
| ---------- | ------------------------------- | -------------------------------------- |
| Validators | `src/lib/domains/validators.ts` | Hostname/label/.cv parsing             |
| Custom     | `src/lib/domains/custom.ts`     | Quota checks, add-domain validation    |
| Cloudflare | `src/lib/domains/cloudflare.ts` | Create/delete custom hostnames via API |

Flow: `POST /api/domains/custom` → validate hostname → check Pro quota → insert row → create Cloudflare custom hostname (when configured) → return verification token.

### .CV Domains (Provider: Ola)

| Module | File                       | Responsibility                             |
| ------ | -------------------------- | ------------------------------------------ |
| DotCV  | `src/lib/domains/dotcv.ts` | Live quote, purchase (disabled by default) |

Flags:

- `DOTCV_ENABLED=false` (default) — quote endpoint returns `source: unavailable`
- `DOTCV_PURCHASE_ENABLED=false` (default) — purchase throws `DOTCV_PURCHASE_DISABLED`
- Live quote required before purchase (`DOTCV_QUOTE_REQUIRED` if no price)
- No hardcoded prices anywhere

## Worker API Routes

| Method | Route                      | Auth | Description                          |
| ------ | -------------------------- | ---- | ------------------------------------ |
| GET    | `/api/billing/plans`       | no   | Public plan cards + configured price |
| GET    | `/api/billing/status`      | yes  | Subscription, entitlements, usage    |
| POST   | `/api/billing/order`       | yes  | Create Razorpay order + local order  |
| POST   | `/api/billing/webhook`     | HMAC | Razorpay webhook (raw body verify)   |
| POST   | `/api/domains/custom`      | yes  | Add custom domain (Pro)              |
| POST   | `/api/domains/dotcv/quote` | yes  | Live .cv quote                       |

## Routes (Frontend)

| Route                | Page    | Auth Required |
| -------------------- | ------- | ------------- |
| `/pricing`           | Pricing | No            |
| `/dashboard/billing` | Billing | Yes           |
| `/dashboard/domains` | Domains | Yes           |

## Environment Variables (Server-Only)

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PRO_ANNUAL_PRICE_PAISE=199900
CURRENCY=INR
SUPABASE_SECRET_KEY=          # preferred (sb_secret_...)
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ZONE_ID=
PLATFORM_PROFILE_ORIGIN=
DOTCV_ENABLED=false
DOTCV_PURCHASE_ENABLED=false
DOTCV_API_BASE_URL=
DOTCV_API_KEY=
RATE_LIMIT_KEY_SECRET=
```

**Never** prefix secrets with `VITE_`.

## Rate Limiting

- Native Cloudflare Rate Limiting binding: `RECRUITER_RATE_LIMITER` (30 req/min per key) in `wrangler.toml`
- In-memory fallback for local development
- Applied to recruiter AI / public API routes (transport-level), separate from product usage quotas

## AI Model Catalog

- Removed fallback model substitution
- `getAvailableModels` / `assertModelAvailable` throw `AIModelUnavailableError` (code `AI_MODEL_UNAVAILABLE`) when catalog is unreachable or model not found
- Only the configured model (`BHARATCODE_MODEL`) is used — no silent fallback

## Tests

| Test File              | Coverage                                              |
| ---------------------- | ----------------------------------------------------- |
| `billing.test.ts`      | Plan limits, price parsing, public plan cards         |
| `entitlements.test.ts` | Subscription resolution, usage windows, order machine |
| `domains.test.ts`      | Hostname validation, .cv parsing, domain quotas       |
| `webhooks.test.ts`     | Payment/webhook HMAC, idempotency, event processing   |
| `catalog.test.ts`      | AI_MODEL_UNAVAILABLE regression (no fallback)         |

## Security Checklist

- [x] No `VITE_` secrets
- [x] Server-side amount authority (order created with `PRO_ANNUAL_PRICE_PAISE`)
- [x] Raw-body webhook HMAC verification
- [x] Event-id idempotency for webhooks
- [x] RLS on all billing/domain tables; no client writes to subscriptions
- [x] Admin key via `SUPABASE_SECRET_KEY` (falls back to service role) — never browser-exposed
- [x] Domain quota enforced against Pro entitlement
- [x] .cv purchase gated behind explicit enable flags + live quote
- [x] No live payments/domains in this pass

## Legacy Cancellation Routes (RETIRED — 410)

The billing model is ONE-TIME ANNUAL PRO ACCESS: there is nothing to cancel
or resume and no automatic renewal.

- `POST /api/billing/subscription/cancel` and `/resume` respond **410 Gone**
  with a truthful explanation; no UI links to them.
- The `cancel_at_period_end` column still exists (removing it would require
  a destructive migration) but is legacy/unused by active code.
- Migration: `supabase/migrations/20260928020000_subscription_cancellation.sql`
  (schema only); enforcement retirement: `20260929150000_entitlement_enforcement_rpcs.sql`.

## Future Enhancements

- [ ] Payment method management and invoices
- [ ] Immediate cancellation / prorated refunds (not in the product contract today)
- [ ] DNS verification polling for custom domains
- [ ] Full .cv purchase flow once provider credentials are live
- [ ] Platform wildcard `username.OURDOMAIN.com` DNS setup (domain purchase pending)
- [ ] Webhook replay protection with timestamp tolerance

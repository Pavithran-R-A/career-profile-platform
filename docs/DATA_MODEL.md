# Data Model

## Stage 7 Tables

### user_subscriptions

| Column               | Type        | Constraints                                |
| -------------------- | ----------- | ------------------------------------------ |
| user_id              | uuid        | PK, FK -> auth.users, cascade              |
| plan                 | text        | NOT NULL, default 'free', CHECK (free/pro) |
| status               | text        | NOT NULL, default 'active', CHECK          |
| current_period_start | timestamptz | nullable                                   |
| current_period_end   | timestamptz | nullable                                   |
| provider             | text        | NOT NULL, default 'razorpay'               |
| provider_customer_id | text        | nullable                                   |
| cancel_at_period_end | boolean     | NOT NULL, default false — LEGACY/UNUSED:   |
|                      |             | billing is one-time annual access, kept    |
|                      |             | only to avoid a destructive migration      |
| created_at           | timestamptz | NOT NULL, default now()                    |
| updated_at           | timestamptz | NOT NULL, auto-updated via trigger         |

RLS: owner SELECT only. Server writes via secret key. One row grants
one-time annual Pro access; renewal webhooks extend
`current_period_end` from max(now, current_period_end) + 1 year.

### billing_orders

| Column              | Type        | Constraints                          |
| ------------------- | ----------- | ------------------------------------ |
| id                  | uuid        | PK, gen_random_uuid()                |
| user_id             | uuid        | FK -> auth.users, cascade            |
| plan_id             | text        | NOT NULL, default 'pro', CHECK (pro) |
| amount_paise        | integer     | NOT NULL, > 0                        |
| currency            | text        | NOT NULL, default 'INR'              |
| status              | text        | NOT NULL, default 'created', CHECK   |
| razorpay_order_id   | text        | UNIQUE, nullable                     |
| razorpay_payment_id | text        | nullable                             |
| created_at          | timestamptz | NOT NULL, default now()              |
| updated_at          | timestamptz | NOT NULL, auto-updated via trigger   |
| paid_at             | timestamptz | nullable                             |

RLS: owner SELECT only.

### billing_webhook_events

| Column      | Type        | Constraints              |
| ----------- | ----------- | ------------------------ |
| event_id    | text        | PK (x-razorpay-event-id) |
| event_type  | text        | nullable                 |
| received_at | timestamptz | NOT NULL, default now()  |

No client RLS (service role only). Idempotency claim.

### usage_counters

| Column     | Type        | Constraints                                                                    |
| ---------- | ----------- | ------------------------------------------------------------------------------ |
| user_id    | uuid        | FK -> auth.users, cascade                                                      |
| metric     | text        | CHECK (resume_variants, github_repos, recruiter_ai, tailoring, custom_domains) |
| window_key | text        | 'YYYY-MM-DD' / 'YYYY-MM' / 'total'                                             |
| count      | integer     | NOT NULL, default 0, >= 0                                                      |
| updated_at | timestamptz | NOT NULL, auto-updated via trigger                                             |

PK: (user_id, metric, window_key). RLS: owner SELECT only.

### custom_domains

| Column                 | Type        | Constraints                        |
| ---------------------- | ----------- | ---------------------------------- |
| id                     | uuid        | PK, gen_random_uuid()              |
| profile_id             | uuid        | FK -> profiles, cascade            |
| hostname               | text        | NOT NULL, UNIQUE                   |
| status                 | text        | default 'pending', CHECK           |
| verification_token     | text        | nullable                           |
| cloudflare_hostname_id | text        | nullable                           |
| last_error             | text        | nullable                           |
| created_at             | timestamptz | NOT NULL, default now()            |
| updated_at             | timestamptz | NOT NULL, auto-updated via trigger |

RLS: owner (via profiles) SELECT/INSERT/DELETE.

### dotcv_domains

| Column             | Type        | Constraints                        |
| ------------------ | ----------- | ---------------------------------- |
| id                 | uuid        | PK, gen_random_uuid()              |
| profile_id         | uuid        | FK -> profiles, cascade            |
| domain_label       | text        | NOT NULL (label without .cv)       |
| domain_name        | text        | NOT NULL, UNIQUE                   |
| status             | text        | default 'quoted', CHECK            |
| provider           | text        | NOT NULL, default 'ola'            |
| provider_reference | text        | nullable                           |
| quote_price_paise  | integer     | nullable, > 0                      |
| last_error         | text        | nullable                           |
| created_at         | timestamptz | NOT NULL, default now()            |
| updated_at         | timestamptz | NOT NULL, auto-updated via trigger |

RLS: owner (via profiles) SELECT/INSERT/DELETE.

## Current Tables (Stage 1)

### profiles

| Column       | Type        | Constraints                        |
| ------------ | ----------- | ---------------------------------- |
| id           | uuid        | PK, gen_random_uuid()              |
| user_id      | uuid        | FK -> auth.users, cascade, UNIQUE  |
| username     | text        | NOT NULL, case-insensitive unique  |
| display_name | text        | nullable                           |
| headline     | text        | nullable                           |
| about        | text        | nullable                           |
| location     | text        | nullable                           |
| avatar_url   | text        | nullable                           |
| visibility   | text        | NOT NULL, default 'draft', CHECK   |
| published_at | timestamptz | nullable                           |
| created_at   | timestamptz | NOT NULL, default now()            |
| updated_at   | timestamptz | NOT NULL, auto-updated via trigger |

### profile_experiences

| Column      | Type        | Constraints                        |
| ----------- | ----------- | ---------------------------------- |
| id          | uuid        | PK, gen_random_uuid()              |
| profile_id  | uuid        | FK -> profiles, cascade            |
| company     | text        | NOT NULL                           |
| role        | text        | NOT NULL                           |
| location    | text        | nullable                           |
| start_year  | integer     | NOT NULL, 1900-2100                |
| start_month | integer     | nullable, 1-12                     |
| end_year    | integer     | nullable, 1900-2100                |
| end_month   | integer     | nullable, 1-12                     |
| is_current  | boolean     | NOT NULL, default false            |
| description | text        | nullable                           |
| sort_order  | integer     | NOT NULL, default 0                |
| created_at  | timestamptz | NOT NULL, default now()            |
| updated_at  | timestamptz | NOT NULL, auto-updated via trigger |

### profile_education

| Column         | Type        | Constraints                        |
| -------------- | ----------- | ---------------------------------- |
| id             | uuid        | PK, gen_random_uuid()              |
| profile_id     | uuid        | FK -> profiles, cascade            |
| institution    | text        | NOT NULL                           |
| degree         | text        | nullable                           |
| field_of_study | text        | nullable                           |
| start_year     | integer     | nullable, 1900-2100                |
| start_month    | integer     | nullable, 1-12                     |
| end_year       | integer     | nullable, 1900-2100                |
| end_month      | integer     | nullable, 1-12                     |
| description    | text        | nullable                           |
| sort_order     | integer     | NOT NULL, default 0                |
| created_at     | timestamptz | NOT NULL, default now()            |
| updated_at     | timestamptz | NOT NULL, auto-updated via trigger |

### profile_projects

| Column         | Type        | Constraints                        |
| -------------- | ----------- | ---------------------------------- |
| id             | uuid        | PK, gen_random_uuid()              |
| profile_id     | uuid        | FK -> profiles, cascade            |
| name           | text        | NOT NULL                           |
| description    | text        | nullable                           |
| project_url    | text        | nullable                           |
| repository_url | text        | nullable                           |
| sort_order     | integer     | NOT NULL, default 0                |
| created_at     | timestamptz | NOT NULL, default now()            |
| updated_at     | timestamptz | NOT NULL, auto-updated via trigger |

### profile_skills

| Column     | Type        | Constraints                        |
| ---------- | ----------- | ---------------------------------- |
| id         | uuid        | PK, gen_random_uuid()              |
| profile_id | uuid        | FK -> profiles, cascade            |
| name       | text        | NOT NULL                           |
| category   | text        | nullable                           |
| sort_order | integer     | NOT NULL, default 0                |
| created_at | timestamptz | NOT NULL, default now()            |
| updated_at | timestamptz | NOT NULL, auto-updated via trigger |

### profile_links

| Column     | Type        | Constraints                        |
| ---------- | ----------- | ---------------------------------- |
| id         | uuid        | PK, gen_random_uuid()              |
| profile_id | uuid        | FK -> profiles, cascade            |
| label      | text        | NOT NULL                           |
| url        | text        | NOT NULL                           |
| sort_order | integer     | NOT NULL, default 0                |
| created_at | timestamptz | NOT NULL, default now()            |
| updated_at | timestamptz | NOT NULL, auto-updated via trigger |

## Claim vs Evidence Principle

The system distinguishes USER CLAIMS from OBSERVED EVIDENCE.

**User Claims** (from profile content):

- "Expert TypeScript developer"
- "5 years of experience"

**Observed Evidence** (from GitHub import):

- "TypeScript appears in repositories X, Y, and Z"
- "Repository X contains GitHub Actions workflows"

Arbitrary skill scores, proficiency percentages, and fake verification badges are prohibited.

## Canonical Profile Model

One canonical structured profile feeds all outputs:

- Public portfolio templates
- Recruiter AI context
- ATS resume generation
- Job-specific profile variants

## Date Representation

Year + optional month (no false precision):

- `start_year: 2020, start_month: 1` = January 2020
- `start_year: 2020, start_month: null` = 2020 (month unknown)
- `end_year: null, end_month: null` with `is_current: true` = Present

## Ordering

All child tables use `sort_order` column for deterministic display ordering.

## Expected Future Tables (not created yet)

- resume_sources
- github_connections
- github_repositories
- profile_evidence
- ai_conversations
- ai_messages
- profile_variants
- profile_views
- contact_leads
- subscriptions
- domain_bindings

Schema evolution is additive. No destructive rewrites expected.

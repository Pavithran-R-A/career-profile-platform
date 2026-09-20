# Data Model

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

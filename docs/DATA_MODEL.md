# Data Model

## Current Tables (Stage 0)

### profiles

| Column       | Type        | Notes                            |
| ------------ | ----------- | -------------------------------- |
| id           | uuid        | PK, gen_random_uuid()            |
| user_id      | uuid        | FK -> auth.users, cascade delete |
| username     | text        | unique (case-insensitive index)  |
| visibility   | text        | 'draft' or 'published'           |
| published_at | timestamptz | nullable                         |
| created_at   | timestamptz | auto                             |
| updated_at   | timestamptz | auto via trigger                 |

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

## Expected Future Tables (not created yet)

- profile_experiences
- profile_education
- profile_projects
- profile_skills
- profile_links
- profile_preferences
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

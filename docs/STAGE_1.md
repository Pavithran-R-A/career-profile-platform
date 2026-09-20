# Stage 1: Authentication + Canonical Profile

## Scope

Implemented email/password authentication with Supabase Auth and a complete canonical profile management system.

## Implemented Behavior

### Authentication

- **Signup:** Email/password registration with validation
- **Login:** Email/password authentication with error handling
- **Logout:** Session clearing and state removal
- **Email verification:** Status page with manual check
- **Password reset:** Request email and reset form
- **Session persistence:** Supabase client persists sessions; auth state subscribes to changes

### Profile Management

- **Onboarding:** 2-step flow (username selection, basic info)
- **Dashboard:** Profile completion tracker, status display, quick actions
- **Editor:** Section-based editor with add/edit/delete for:
  - Basics (display name, headline, about, location)
  - Experience (company, role, dates, description)
  - Education (institution, degree, field, dates)
  - Projects (name, description, URLs)
  - Skills (name, category)
  - Links (label, URL)

### Routing

- **Public routes:** `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`
- **Protected routes:** `/dashboard`, `/dashboard/profile`
- **Guest-only routes:** `/login`, `/signup` (redirect to dashboard if authenticated)
- **404 handling:** Custom NotFound page

## Auth Flow

1. User signs up → redirected to `/verify-email`
2. User verifies email (via Supabase link) → redirected to login
3. User logs in → redirected to dashboard
4. If no profile exists → redirected to `/onboarding`
5. Onboarding creates profile → redirected to dashboard
6. Dashboard shows profile status and editor link

## Database Schema

### Tables Created

- `profiles` - Core profile with identity, visibility
- `profile_experiences` - Work experience entries
- `profile_education` - Education entries
- `profile_projects` - Project entries
- `profile_skills` - Skills
- `profile_links` - External links

### Constraints

- `profiles.user_id` unique (one profile per user)
- `lower(username)` unique index (case-insensitive)
- Visibility check constraint ('draft' or 'published')
- Foreign keys with CASCADE delete
- Month range constraints (1-12)
- Year sanity constraints (1900-2100)
- Current experience end-date consistency

## RLS / Grants

### Profiles Table

- **Grants:** SELECT, INSERT, UPDATE, DELETE to `authenticated` role
- **RLS Policies:**
  - SELECT: `auth.uid() = user_id`
  - INSERT: `WITH CHECK (auth.uid() = user_id)`
  - UPDATE: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
  - DELETE: `USING (auth.uid() = user_id)`

### Child Tables (experiences, education, projects, skills, links)

- **Grants:** SELECT, INSERT, UPDATE, DELETE to `authenticated` role
- **RLS Policies:** All operations verify parent profile ownership via EXISTS check

### Anonymous Access

- No application-table access for anonymous users

## Environment Setup

### Required Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### Optional Variables

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only
```

## Local Run Steps

1. Clone repository
2. Copy `.env.example` to `.env`
3. Fill in Supabase credentials
4. Run `pnpm install`
5. Run `pnpm dev`
6. Access at `http://localhost:5173`

## Remote Qualification Procedure

1. Create Supabase project at https://supabase.com
2. Run migrations in SQL editor
3. Enable Email auth
4. Configure redirect URLs in Authentication > URL Configuration
5. Test signup → verification → login → profile creation

## Known Limitations

- No Google OAuth (deferred to avoid coupling with GitHub integration)
- No public portfolio publishing (Stage 3)
- No resume upload (Stage 2)
- No AI features (Stage 2+)
- Database types are manually maintained (Supabase CLI generation not configured)

## Stage 2 Handoff

- Auth system is production-ready for email/password
- Profile schema supports all Stage 1 fields
- RLS policies enforce owner-only access
- Environment uses publishable key naming
- Tests cover auth validation, routing, and profile schemas

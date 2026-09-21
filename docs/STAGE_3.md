# Stage 3: Portfolio Templates + Public Publishing

## Scope

Implemented public portfolio rendering with wildcard subdomain routing, multiple template options, mobile-responsive layouts, and profile privacy controls. Users can publish their profiles to a public URL with customizable templates and accent colors.

## Implemented Behavior

### Public Profile Rendering

- **Public profile endpoint:** `/u/:username` serves published profiles
- **Template selection:** Users choose from registered templates (classic, modern, minimal, bold)
- **Accent color customization:** User-selectable accent colors applied to template
- **Section ordering:** Configurable order of profile sections (basics, education, experience, skills, projects)
- **Hidden sections:** Users can hide specific sections from public view
- **Responsive layouts:** All templates support mobile, tablet, and desktop viewports

### Template System

- **Template registry:** Centralized template registration and lookup via `registerTemplate` / `getTemplate`
- **Template metadata:** Schema-validated metadata (id, name, description, version, author, tags)
- **Template config:** Structured config with colors, fonts, layout, spacing, and border radius
- **Layout options:** Single column, sidebar, two-column layouts
- **Spacing options:** Compact, normal, relaxed spacing presets
- **Font system:** Heading, body, and monospace font configuration per template

### Publishing Controls

- **Visibility toggle:** Draft/published state on profile
- **Unpublish:** Published profiles can be reverted to draft
- **Username-based URLs:** Public profiles accessible via `/u/:username`
- **Profile completeness:** Minimum identity fields required for publishing

### Profile Preferences

- **Template preference:** Stored per profile, defaults to 'classic'
- **Accent preference:** Stored per profile, defaults to 'blue'
- **Section order:** Stored as ordered string array, defaults to standard order
- **Hidden sections:** Stored as string array of section keys to hide
- **Default values:** Applied when preferences are not explicitly set

## Database Schema

### Tables Modified

- `profile_preferences` - Stores template, accent, section order, and hidden sections per profile
  - `profile_id` (uuid, FK to profiles, unique)
  - `template_key` (text, default 'classic')
  - `accent_key` (text, default 'blue')
  - `section_order` (text[], default standard order)
  - `hidden_sections` (text[], default empty array)

### Public Profile View

- `public_profiles` - Materialized view for safe public profile data
  - Excludes `user_id` and other internal fields
  - Includes only published profiles
  - Joined with profile preferences for template/accent data

## RLS / Grants

### profile_preferences Table

- **Grants:** SELECT, INSERT, UPDATE to `authenticated` role
- **RLS Policies:**
  - SELECT: `auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)`
  - INSERT: `WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id))`
  - UPDATE: `USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)) WITH CHECK (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id))`

### Public Profile Access

- **Published profiles:** Readable by anonymous users via public view
- **Draft profiles:** Only visible to profile owner
- **Username uniqueness:** Enforced via unique constraint on `lower(username)`

## Environment Setup

### Required Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### Optional Variables

```
VITE_DEFAULT_TEMPLATE=classic          # Default template for new profiles
VITE_DEFAULT_ACCENT=blue               # Default accent color for new profiles
```

## Local Run Steps

1. Clone repository
2. Copy `.env.example` to `.env`
3. Fill in Supabase credentials
4. Run `pnpm install`
5. Run `pnpm dev`
6. Access at `http://localhost:5173`
7. Navigate to `/u/:username` to view published profiles

## Remote Qualification Procedure

1. Create Supabase project at https://supabase.com
2. Run Stage 3 migrations in SQL editor
3. Verify `public_profiles` view is created
4. Test profile publishing flow:
   - Create profile → set preferences → publish → view at `/u/:username`
5. Test unpublishing flow:
   - Unpublish → verify profile returns 404 for anonymous users
6. Test template rendering:
   - Switch templates → verify public profile reflects changes
7. Test accent color changes:
   - Change accent → verify public profile reflects new color
8. Test section ordering:
   - Reorder sections → verify public profile renders in new order
9. Test hidden sections:
   - Hide a section → verify it does not appear in public profile

## Security Considerations

### Public Data Exposure

- Only published profiles are visible to anonymous users
- `user_id` is never exposed in public DTOs
- Internal fields (id, createdAt, updatedAt) excluded from public responses
- `showEmail` preference not exposed in public view

### Template Injection Prevention

- Template metadata validated via Zod schema before rendering
- Template config validated for safe color/font/layout values
- No user-provided HTML rendered without sanitization

## Known Limitations

- No custom domain support (deferred to Stage 7)
- No template preview before publishing
- No A/B testing for templates
- No analytics on profile views
- No rate limiting on public profile endpoints
- No caching layer for public profiles

## Stage 4 Handoff

- Public profile system is production-ready for published profiles
- Template registry supports adding new templates without code changes
- RLS policies enforce owner-only access for preferences
- Public DTOs exclude all sensitive fields
- Tests cover template validation, accent validation, section ordering, hidden sections, public DTO privacy, and resume import interface

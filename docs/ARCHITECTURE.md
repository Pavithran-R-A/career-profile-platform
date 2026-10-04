# Architecture

## System Overview

```
Browser <-> Cloudflare Worker (API + static assets)
                |
                v
         Supabase (PostgreSQL + Auth + Storage)
                |
                v
         AI Provider (abstracted, future)
```

### Rendering model (truthful description)

This is **server-rendered metadata with a client-rendered application
body** — not full React SSR. For crawler-visible routes (`/`, `/pricing`, legal/contact routes,
`/u/:username`, unknown routes) the worker injects a complete, route-accurate
`<head>` (exactly one `title`, description, canonical, OG/Twitter tags,
JSON-LD, and `noindex` where appropriate) into the static HTML shell before
responding. The visible body is then hydrated by React in the browser.

## Frontend

- React 19 + TypeScript (strict mode)
- Vite for development and bundling
- Tailwind CSS for styling
- React Router for client-side routing
- Deployed as static assets via Cloudflare Workers

## Routing Model

### Public Routes

- `/` - Landing page
- `/login` - Login form
- `/signup` - Registration form
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset form
- `/pricing` - Plan comparison and upgrade CTA
- `/privacy` - Privacy policy
- `/terms` - Terms of service
- `/refund-policy` - Refund and cancellation policy
- `/contact` - Production support/contact details
- `/u/:username` - Published career profile

### Protected Routes (require authentication)

- `/dashboard` - User dashboard
- `/dashboard/profile` - Profile editor
- `/dashboard/billing` - Subscription, usage, and upgrade
- `/dashboard/domains` - Custom domains and .cv quotes

### Guest-Only Routes (redirect to dashboard if authenticated)

- `/login`
- `/signup`

### Fallback

- `*` - 404 Not Found

## Auth Flow

1. **Signup:** User creates account → email verification required
2. **Login:** User authenticates → session established
3. **Session:** Supabase client persists session; auth state subscribes to changes
4. **Protected routes:** Redirect to `/login` if unauthenticated
5. **Onboarding:** New users without profile redirected to `/onboarding`

## API Layer

- Cloudflare Workers serve API routes at `/api/*`
- Static frontend assets served by the same Worker
- API routes return JSON; unknown API routes return JSON 404
- SPA routes receive HTML fallback for client-side routing

## Database / Auth

- Supabase provides PostgreSQL, authentication, and storage
- Row Level Security (RLS) enforced on all tables
- Explicit GRANT statements for authenticated role
- No service-role/secret key in browser code
- Publishable key used for authenticated client-side RLS operations
- Server-only public profile projections are read by the Worker using the Supabase secret and returned as a constrained DTO

## Security Model

### Trust Boundaries

- **Browser:** Untrusted user input
- **Supabase Client:** Uses publishable key only
- **Cloudflare Worker:** Trusted server boundary; holds only required server secrets
- **Supabase Database:** RLS enforces access control

### Access Control

- **Profiles:** Owner-only CRUD via RLS
- **Child tables:** Ownership verified through parent profile
- **Anonymous:** No direct application-table or public-projection-view access after production cutover; public profiles are served through the Worker

## Wildcard Subdomain Routing

Future architecture for `username.ourdomain.com`:

1. Wildcard DNS configured at domain registrar pointing to Cloudflare
2. Cloudflare Worker receives requests for `*.ourdomain.com`
3. Worker extracts username from Host header
4. Worker looks up published profile by username
5. Worker renders the profile using a template or returns JSON for a frontend SPA route

Not implemented in Stage 1. Reserved in architecture documentation.

## AI Abstraction

- `AIProvider` interface defined in `src/lib/ai/provider.ts`
- Application operations (`extractProfile`, `answerQuestion`) depend on the interface
- Provider implementation injected at runtime (server-side only)
- AI keys never exposed to the browser
- Structured output validation required for all provider responses

## Data Access Layer

```
UI Components
    ↓
Profile Service (src/lib/profiles/service.ts)
    ↓
Profile Repository (src/lib/profiles/repository.ts)
    ↓
Supabase Client (src/lib/supabase/client.ts)
    ↓
Database (RLS-protected)
```

- Service layer handles business logic and validation
- Repository layer handles data access
- Errors translated to application-level errors
- Raw database errors never exposed to UI

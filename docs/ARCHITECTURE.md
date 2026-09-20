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

## Frontend

- React 19 + TypeScript (strict mode)
- Vite for development and bundling
- Tailwind CSS for styling
- Deployed as static assets via Cloudflare Workers

## API Layer

- Cloudflare Workers serve API routes at /api/*
- Static frontend assets served by the same Worker
- No separate backend server

## Database / Auth

- Supabase provides PostgreSQL, authentication, and storage
- Row Level Security (RLS) enforced on all tables
- No service-role key in browser code

## Wildcard Subdomain Routing

Future architecture for username.ourdomain.com:

1. Wildcard DNS configured at domain registrar pointing to Cloudflare
2. Cloudflare Worker receives requests for *.ourdomain.com
3. Worker extracts username from Host header
4. Worker looks up published profile by username
5. Worker renders the profile using a template or returns JSON for a frontend SPA route

Not implemented in Stage 0. Reserved in architecture documentation.

## AI Abstraction

- `AIProvider` interface defined in `src/lib/ai/provider.ts`
- Application operations (extractProfile, answerQuestion) depend on the interface
- Provider implementation injected at runtime (server-side only)
- AI keys never exposed to the browser
- Structured output validation required for all provider responses

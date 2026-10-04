# CVentory

> Your career. All in one place — from CV and GitHub work to a recruiter-ready profile, ATS resume, and shareable portfolio.

## Tech Stack

- React 19 + TypeScript (strict mode)
- Vite
- Tailwind CSS
- Cloudflare Workers
- Supabase (PostgreSQL, Auth, Storage)
- React Router
- Zod (validation)
- Vitest (testing)

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 11+

### Setup

```bash
cp .env.example .env
# Fill in Supabase credentials in .env
pnpm install
pnpm dev
```

### Supabase Configuration

1. Create a Supabase project at https://supabase.com
2. Get your project URL, publishable key, and a server-side secret key from Settings > API.
3. Add them to `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_SECRET_KEY=your-server-only-secret
   ```
   Never expose `SUPABASE_SECRET_KEY` to browser code or commit it.
4. Apply the database migrations (all files in `supabase/migrations/`, in
   filename order). With the Supabase CLI linked to your project:
   `supabase db push`
5. Enable Email auth in Authentication > Providers

### Commands

| Command                 | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `pnpm dev`              | Start development server                                            |
| `pnpm build`            | Production build                                                    |
| `pnpm preview`          | Preview production build                                            |
| `pnpm test`             | Run unit tests                                                      |
| `pnpm test:integration` | Run live-RLS integration tests (requires a linked Supabase project) |
| `pnpm test:coverage`    | Run tests with coverage                                             |
| `pnpm test:e2e`         | Run Playwright E2E suite                                            |
| `pnpm bundle:scan`      | Report production chunk sizes                                       |
| `pnpm lint`             | Run ESLint                                                          |
| `pnpm typecheck`        | Run TypeScript type checking                                        |
| `pnpm format`           | Format code with Prettier                                           |
| `pnpm format:check`     | Check formatting                                                    |

## Project Structure

```
src/
  components/    # Reusable UI components
  config/        # Environment and configuration
  lib/           # Domain logic and utilities
    auth/        # Authentication context and types
    ai/          # AI provider abstraction
    profiles/    # Canonical profile types, schemas, repository
    supabase/    # Supabase client boundaries
    validators/  # Input validation (username, etc.)
  pages/         # Route-level page components
    auth/        # Authentication pages
  tests/         # Unit and UI tests
  workers/       # Cloudflare Worker handlers
supabase/
  migrations/    # Database migrations
docs/            # Architecture and product documentation
```

## Features

- Email/password authentication with verification and password reset
- Profile editing (basics, experience, education, projects, skills, links,
  achievements) with publish/draft visibility
- Resume import (PDF parsing in the Worker) with ATS builder and job tailoring
- GitHub App integration: repository sync as verifiable public evidence
- Public portfolio with selectable templates and recruiter AI Q&A grounded in
  published content only
- One-time annual Pro plan (Razorpay orders) with server-side entitlements
- Custom domains and account self-deletion with full data cleanup

See [docs/ROADMAP.md](docs/ROADMAP.md) for the staged plan and current status.

## License

Private - not yet licensed for distribution.

# Career Profile Platform

> Turn your CV and GitHub into a professional identity recruiters can understand and verify.

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
2. Get your project URL and publishable key from Settings > API
3. Add them to `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```
4. Run the migrations in the Supabase SQL editor:
   - `supabase/migrations/20260920000000_initial.sql`
   - `supabase/migrations/20260920010000_expand_profile_schema.sql`
5. Enable Email auth in Authentication > Providers

### Commands

| Command              | Description                   |
| -------------------- | ----------------------------- |
| `pnpm dev`           | Start development server      |
| `pnpm build`         | Production build              |
| `pnpm preview`       | Preview production build      |
| `pnpm test`          | Run unit tests                |
| `pnpm test:coverage` | Run tests with coverage       |
| `pnpm test:e2e`      | Run Playwright E2E suite      |
| `pnpm bundle:scan`   | Report production chunk sizes |
| `pnpm lint`          | Run ESLint                    |
| `pnpm typecheck`     | Run TypeScript type checking  |
| `pnpm format`        | Format code with Prettier     |
| `pnpm format:check`  | Check formatting              |

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

## Features (Stage 1)

- Email/password authentication
- Email verification
- Password reset
- Profile creation with unique username
- Profile editing (basics, experience, education, projects, skills, links)
- Protected routes
- Mobile-responsive design

## License

Private - not yet licensed for distribution.

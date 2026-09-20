# Career Profile Platform

> Turn your CV and GitHub into a professional identity recruiters can understand and verify.

## Tech Stack

- React 19 + TypeScript (strict mode)
- Vite
- Tailwind CSS
- Cloudflare Workers
- Supabase (PostgreSQL, Auth, Storage)
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

### Commands

| Command             | Description                    |
|---------------------|--------------------------------|
| `pnpm dev`          | Start development server       |
| `pnpm build`        | Production build               |
| `pnpm preview`      | Preview production build       |
| `pnpm test`         | Run unit tests                 |
| `pnpm test:coverage`| Run tests with coverage        |
| `pnpm lint`         | Run ESLint                     |
| `pnpm typecheck`    | Run TypeScript type checking   |
| `pnpm format`       | Format code with Prettier      |
| `pnpm format:check` | Check formatting               |

## Project Structure

```
src/
  components/    # Reusable UI components
  config/        # Environment and configuration
  lib/           # Domain logic and utilities
    ai/          # AI provider abstraction
    profiles/    # Canonical profile types and schemas
    supabase/    # Supabase client boundaries
    validators/  # Input validation (username, etc.)
  pages/         # Route-level page components
  tests/         # Unit and UI tests
  workers/       # Cloudflare Worker handlers
supabase/
  migrations/    # Database migrations
docs/            # Architecture and product documentation
```

## License

Private - not yet licensed for distribution.

# Stage 4: GitHub Integration

## Overview

Stage 4 connects GitHub accounts to the CareerProfile Go, enabling users to derive evidence-based profile content from their open-source contributions, commits, pull requests, and releases.

## Architecture

### Database Tables

Three new tables were added via migration `20260920070000_stage4_github.sql`:

| Table                 | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `github_connections`  | Links a profile to a GitHub App installation                     |
| `github_repositories` | Mirrors metadata of repos accessible to the installation         |
| `profile_evidence`    | Stores extracted evidence items (commits, PRs, issues, releases) |

### Key Types (`src/lib/github/types.ts`)

- `GitHubConnection` — DB model for installation links
- `GitHubRepositoryRecord` — DB model for repo metadata
- `ProfileEvidence` — Extracted evidence from GitHub activity
- `SyncResult` — Aggregated sync operation results
- `GitHubAppConfig` — App credentials (appId, privateKey, etc.)

### Modules

| File                             | Responsibility                                                  |
| -------------------------------- | --------------------------------------------------------------- |
| `src/lib/github/jwt.ts`          | Creates & caches short-lived JWTs for GitHub App authentication |
| `src/lib/github/installation.ts` | Fetches & caches installation access tokens                     |
| `src/lib/github/client.ts`       | Typed GitHub API client with pagination & sync helpers          |

## Components

| Component              | File                                      | Purpose                                                 |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `GitHubDashboard`      | `src/pages/GitHubDashboard.tsx`           | Main page orchestrating connection, repos, and evidence |
| `GitHubConnectionCard` | `src/components/GitHubConnectionCard.tsx` | Displays connection status or install prompt            |
| `RepositoryList`       | `src/components/RepositoryList.tsx`       | Filterable repo list with selection toggles             |
| `EvidenceList`         | `src/components/EvidenceList.tsx`         | Filterable evidence display with public/private toggle  |

## Evidence Extraction

Evidence is extracted from GitHub API responses:

1. **Commits** — First line of commit message, author, verification status
2. **Pull Requests** — Title, additions/deletions, merge status
3. **Releases** — Tag name, prerelease flag, asset count

Extraction logic is tested in `src/tests/unit/evidence.test.ts`.

## Sync Engine

The sync engine iterates over selected repositories and pulls:

- Recent commits (filtered by `last_synced_at`)
- All pull requests
- Open and closed issues
- Releases

Results are stored in `profile_evidence` with deduplication by `source_url` or `source_commit_sha`.

Tested in `src/tests/unit/github-sync.test.ts`.

## Row-Level Security

All three tables have RLS enabled:

- Users can only CRUD their own connections, repos, and evidence
- Public evidence is readable by anyone (via `published_evidence` view)
- Repository access is scoped through the connection ownership chain

## Setup

See `docs/GITHUB_APP_SETUP.md` for GitHub App creation instructions.

## Routes

The GitHub dashboard is accessible at `/dashboard/github` (requires authentication).

## Tests

| Test File                            | Coverage                                        |
| ------------------------------------ | ----------------------------------------------- |
| `src/tests/unit/github-jwt.test.ts`  | JWT creation, caching, validation               |
| `src/tests/unit/evidence.test.ts`    | Evidence extraction from commits, PRs, releases |
| `src/tests/unit/github-sync.test.ts` | Sync engine, progress tracking, deduplication   |

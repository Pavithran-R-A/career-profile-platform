# Release Protection — GitHub `master` Rules

> Status: reviewed 2026-10-17 against `career-profile-platform` (public repo,
> default branch `master`, deployed SHA verified via `/api/health` `buildSha`).

## Current state (as reviewed)

| Control                           | State                           |
| --------------------------------- | ------------------------------- |
| `master` branch protection        | **off** (no classic protection) |
| Repository rulesets               | **none**                        |
| Force pushes to `master`          | allowed (accidental risk)       |
| Branch deletion                   | allowed                         |
| Dependabot security updates       | disabled                        |
| Secret scanning / push protection | disabled                        |

Consequence: a stray `git push --force`, an accidental `git reset --hard && git
push -f`, or a bad direct push can silently rewrite the exact-SHA chain that
the Cloudflare deployment and rollback evidence (`.rollback-evidence.log`,
`/api/health` `buildSha`) depend on.

## Design goals

1. **History is immutable.** No force pushes or deletions of `master` — the
   deployed-SHA chain (`git rev-parse HEAD == origin/master ==
/api/health buildSha`) must remain auditable and roll-back-able.
2. **Unsafe releases cannot land unreviewed or red.** Once activated, changes
   reach `master` only through a pull request whose CI (the existing `CI`
   workflow: _Format, Lint, Typecheck, Unit, Build_ + _E2E (Playwright,
   desktop + mobile)_) is green on the exact head SHA.
3. **The Cloudflare deployment process is untouched.** Deployment is an
   explicit local action (`pnpm build && npx wrangler deploy`) from a verified
   merged SHA, followed by a three-way parity check
   (`HEAD == origin/master == /api/health buildSha`). Nothing in this design
   changes how a verified SHA is built or deployed; it only changes how code
   reaches `master`.
4. **Reversible and staged.** Rules are split so the harmless, always-correct
   part is active immediately and the flow-changing part waits for explicit
   owner approval.

## Rule set A — history protection (ACTIVE)

Ruleset name: `Protect master history`
Enforcement: `active`, ref: `refs/heads/master`, no bypass actors.

| Rule               | Effect                                                       |
| ------------------ | ------------------------------------------------------------ |
| `deletion`         | `master` cannot be deleted (API/UI/CLI).                     |
| `non_fast_forward` | Force pushes (`--force`, `--force-with-lease`) are rejected. |

Why this cannot break anything: normal development only ever fast-forwards.
Recovery from a bad change is `git revert`, which keeps the SHA chain intact
and is exactly what the rollback evidence process expects.

## Rule set B — CI-gated release (DESIGNED, NOT ACTIVE — owner decision)

Ruleset name: `Require CI before merge to master`
Enforcement: `disabled` (documented, ready to enable)
Ref: `refs/heads/master`, `do_not_enforce_on_create: true` so it never blocks
an initial commit.

| Rule                     | Effect                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pull_request`           | Changes to `master` must arrive via PR; `required_approving_review_count: 0` (solo repo — reviews stay optional, CI stays mandatory). |
| `required_status_checks` | `Format, Lint, Typecheck, Unit, Build` and `E2E (Playwright, desktop + mobile)` must be green on the PR head SHA.                     |

Compatibility notes for the exact-SHA deploy flow:

- Direct pushes to `master` (including agent-assisted commits) would be
  **rejected**; the flow becomes: branch → `gh pr create` → CI green →
  `gh pr merge` → `git pull` → deploy merged SHA.
- The two check names must match the workflow's `jobs.<id>.name` exactly;
  renaming those jobs in `ci.yml` without updating this ruleset would block
  all merges.
- Deployment itself stays a manual, verified action; no GitHub Environment or
  auto-deploy is introduced, so production credentials are unaffected.

Why it is not active yet: it changes the daily workflow for the only human
contributor and every agent session. Activation should be an explicit owner
decision (one command, documented below).

## Activation / rollback

```bash
# Rule set A is applied via API (see evidence below).
gh api repos/Pavithran-R-A/career-profile-platform/rulesets

# Owner opts in to CI-gated merges:
gh api -X PATCH repos/Pavithran-R-A/career-profile-platform/rulesets/<RULESET_B_ID> \
  -f enabled=true

# Full rollback (either set):
gh api -X DELETE repos/Pavithran-R-A/career-profile-platform/rulesets/<ID>
```

## Related recommendations (owner decisions, not activated)

- **Dependabot security updates** — currently disabled; enabling is one click
  and does not affect deploys.
- **Secret scanning + push protection** — free for public repos and would have
  blocked the class of leak the security review specifically watches for
  (service-role keys in the bundle or in git history).
- **Signed commits** are unnecessary at this size; the SHA-parity check
  already binds deployed code to reviewed code.

## Applied instance IDs (2026-10-17)

| Ruleset                             | ID         | Enforcement               |
| ----------------------------------- | ---------- | ------------------------- |
| `Protect master history`            | `25304942` | **active**                |
| `Require CI before merge to master` | `25304979` | `disabled` (owner opt-in) |

## Evidence

- Review of live settings: `gh api repos/.../branches/master` →
  `protected: false`; `gh api repos/.../rulesets` → `[]` (2026-10-17).
- Deploy chain this protects: commits `89d2469` → `f674ae7` → `1c9e4e9`, each
  with green CI ([run 39038224507](https://github.com/Pavithran-R-A/career-profile-platform/actions/runs/39038224507))
  and deployed-SHA parity verified via `/api/health`.

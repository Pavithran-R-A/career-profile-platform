/**
 * GitHub integration server core.
 *
 * EVERY function takes an explicit, immutable GitHubModuleConfig resolved
 * from the request's Env (see resolveGitHubConfig). Nothing here reads
 * process.env, so concurrent requests with different configurations cannot
 * bleed into each other.
 *
 * Pipeline (both bounded):
 *   syncConnectionRepositories — repo metadata only (bounded pagination).
 *   generateEvidenceForSelected — for SELECTED repos: bounded commits/PRs/
 *     releases via GitHubClient → real evidence extraction → persist to
 *     profile_evidence, deduped by stable source identity, is_public=false.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { clearInstallationTokenCache } from './installation';
import { isGitHubAppConfigured, type GitHubModuleConfig } from './config';
import { GitHubClient } from './client';
import {
  extractCommitsEvidence,
  extractPullRequestsEvidence,
  extractIssuesEvidence,
  extractReleasesEvidence,
  extractAllEvidence,
  DEFAULT_EVIDENCE_TUNING,
  type EvidenceTuning,
} from './evidence';
import type { GitHubRepository, ProfileEvidence } from './types';

// ─── Signed OAuth/install state ────────────────────────────────
//
// state = base64url(payload).base64url(hmac_sha256(payload, secret))
// payload = { u: userId, n: nonce, t: issuedAtSeconds, e: expirySeconds }

const STATE_TTL_S = 600; // 10 minutes

export interface GitHubStatePayload {
  u: string;
  n: string;
  t: number;
  e: number;
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function fromB64urlJson<T>(raw: string): T | null {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function hmacB64url(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Signed-state secret: EXPLICITLY configured GITHUB_STATE_SECRET only.
 * There is no fallback to the client secret (or any other credential):
 * deriving the state key from another secret silently rotates every issued
 * state when one variable changes and couples two secrets that must stay
 * independent. createSignedState refuses to operate without it, so a
 * partially configured production GitHub integration can never issue an
 * install state (and therefore never starts a flow that cannot complete).
 */
export function makeStateSecret(config: GitHubModuleConfig): string {
  return config.stateSecret;
}

export function createSignedState(userId: string, config: GitHubModuleConfig): string {
  // Refuse to mint states under a partially configured Flow A — without the
  // explicit state secret (or the rest of the App identity) the callback
  // could never verify the state, so starting the flow would be a lie.
  if (!isGitHubAppConfigured(config)) {
    throw new Error('GITHUB_NOT_CONFIGURED');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: GitHubStatePayload = {
    u: userId,
    n: crypto.randomUUID(),
    t: now,
    e: now + STATE_TTL_S,
  };
  const body = b64urlJson(payload);
  const sig = hmacB64url(makeStateSecret(config), body);
  return `${body}.${sig}`;
}

export interface StateVerification {
  ok: boolean;
  reason?: 'malformed' | 'bad_signature' | 'expired' | 'user_mismatch';
  payload?: GitHubStatePayload;
}

export function verifySignedState(
  state: string,
  config: GitHubModuleConfig,
  expectedUserId: string
): StateVerification {
  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [body, sigRaw] = parts;
  const expected = hmacB64url(makeStateSecret(config), body);
  // Constant-time string comparison (both sides are base64url digests).
  if (!safeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sigRaw, 'utf8'))) {
    return { ok: false, reason: 'bad_signature' };
  }

  const payload = fromB64urlJson<GitHubStatePayload>(body);
  if (!payload || typeof payload.u !== 'string' || typeof payload.e !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.e < now) return { ok: false, reason: 'expired' };
  if (payload.u !== expectedUserId) return { ok: false, reason: 'user_mismatch' };
  return { ok: true, payload };
}

// ─── App identity helpers ─────────────────────────────────────

export function githubAppSlug(config: GitHubModuleConfig): string | null {
  return config.appSlug.length > 0 ? config.appSlug : null;
}

/**
 * Public-safe, non-secret values the dashboard needs to render the install
 * entry point. Everything here is already public on a GitHub App listing.
 */
export function githubInstallInfo(config: GitHubModuleConfig): {
  configured: boolean;
  slug: string | null;
  installUrl: string | null;
} {
  const configured = isGitHubAppConfigured(config) && Boolean(config.appSlug);
  const slug = githubAppSlug(config);
  return {
    configured,
    slug,
    installUrl: configured && slug ? `https://github.com/apps/${slug}/installations/new` : null,
  };
}

// ─── Installation resolution (Flow A: OAuth during install) ─────
//
// GitHub's OAuth-during-install callback carries ONLY `code` (+ `state`);
// the Setup URL is unavailable in this mode, so there is NO installation_id
// from the browser. The installation is resolved server-side from GitHub's
// own listing: exchange the code for a GitHub App USER access token, call
// GET /user/installations, and filter to installations of THIS app
// (app_slug). A browser-supplied installation id is never authority — the
// only place one is accepted is the explicit selection round-trip, where it
// must match a server-signed selection token AND pass an App-JWT check.

export interface VerifiedInstallation {
  installationId: number;
  accountLogin: string;
  accountId: number;
  accountType: string;
}

/** Fetches the authenticated App (GET /app) using the App JWT. */
async function appJwt(config: GitHubModuleConfig): Promise<string> {
  const { getGitHubJWT } = await import('./jwt');
  return getGitHubJWT(config.jwt);
}

/**
 * Verifies via the App JWT that an installation exists on THIS app and
 * belongs to the expected GitHub account id. Second, independent credential
 * check on top of the user access token listing.
 */
export async function verifyInstallationForAccount(
  installationId: number,
  expectedAccountId: number,
  config: GitHubModuleConfig
): Promise<VerifiedInstallation | null> {
  const jwt = await appJwt(config);
  const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id: number;
    account: { login: string; id: number; type: string } | null;
  };
  if (!data.account || data.account.id !== expectedAccountId) return null;
  return {
    installationId: data.id,
    accountLogin: data.account.login,
    accountId: data.account.id,
    accountType: data.account.type,
  };
}

/** Exchanges an OAuth code for a GitHub App user access token. */
async function exchangeCodeForUserAccessToken(
  code: string,
  config: GitHubModuleConfig
): Promise<string | null> {
  const clientId = config.app.clientId;
  const clientSecret = config.app.clientSecret;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; error?: string };
  return data.access_token ?? null;
}

/**
 * Lists installations of THIS GitHub App that the user access token can
 * access (GET /user/installations). Returns null when the GitHub request
 * itself fails; an empty array means the user has no eligible installation.
 */
export async function listInstallationsForUserToken(
  accessToken: string,
  config: GitHubModuleConfig
): Promise<Array<{
  installationId: number;
  accountLogin: string;
  accountId: number;
  accountType: string;
}> | null> {
  const res = await fetch('https://api.github.com/user/installations?per_page=100', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    installations?: Array<{
      id?: number;
      account?: { login?: string; id?: number; type?: string } | null;
      app_slug?: string;
    }>;
  };
  return (data.installations ?? [])
    .filter(
      (i) =>
        typeof i.id === 'number' &&
        i.id > 0 &&
        i.account != null &&
        typeof i.account.id === 'number' &&
        typeof i.account.login === 'string' &&
        // Only THIS app's installations are eligible.
        (!config.appSlug || i.app_slug === config.appSlug)
    )
    .map((i) => ({
      installationId: i.id as number,
      accountLogin: i.account?.login as string,
      accountId: i.account?.id as number,
      accountType: typeof i.account?.type === 'string' ? i.account.type : 'User',
    }));
}

export type InstallationResolution =
  | { status: 'no_eligible' }
  | { status: 'single'; installation: VerifiedInstallation }
  | { status: 'multiple'; installations: VerifiedInstallation[] }
  | {
      status: 'error';
      reason: 'exchange_failed' | 'installations_lookup_failed' | 'verify_failed';
    };

/**
 * Flow A core: code → user access token → GET /user/installations → the
 * installation(s) of this app accessible to that GitHub user. Exactly one
 * eligible installation is additionally cross-verified with the App JWT.
 * Multiple eligible installations are returned verbatim — the caller must
 * ask the user to choose; nothing is guessed.
 */
export async function resolveInstallationForUser(
  code: string,
  config: GitHubModuleConfig
): Promise<InstallationResolution> {
  const accessToken = await exchangeCodeForUserAccessToken(code, config);
  if (!accessToken) return { status: 'error', reason: 'exchange_failed' };

  const installations = await listInstallationsForUserToken(accessToken, config);
  if (installations === null) {
    return { status: 'error', reason: 'installations_lookup_failed' };
  }
  if (installations.length === 0) return { status: 'no_eligible' };
  if (installations.length === 1) {
    const only = installations[0];
    const verified = await verifyInstallationForAccount(
      only.installationId,
      only.accountId,
      config
    );
    if (!verified) return { status: 'error', reason: 'verify_failed' };
    return { status: 'single', installation: verified };
  }
  return { status: 'multiple', installations };
}

// ─── Sync: repository metadata ────────────────────────────────

export interface SyncOutcome {
  ok: boolean;
  reason?: 'not_configured' | 'no_connection' | 'github_error';
  repositoriesSynced?: number;
  totalAvailable?: number;
}

interface RepoMetaStore {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => Promise<{ data: unknown; error: unknown }>;
    };
    upsert: (rows: unknown) => Promise<{ error: unknown }>;
  };
}

/**
 * Lists the installation's repositories (bounded pagination), then upserts
 * github_repositories rows by github_repo_id. Owner data only; selection
 * and public flags are preserved from any previous rows, so a repository
 * rename (same github_repo_id) keeps its identity.
 */
export async function syncConnectionRepositories(params: {
  connectionId: string;
  installationId: number;
  config: GitHubModuleConfig;
  supabase: RepoMetaStore;
  maxRepositories?: number;
}): Promise<SyncOutcome> {
  const { connectionId, installationId, config, supabase, maxRepositories } = params;
  const limit = maxRepositories ?? config.syncLimits.maxRepositories;

  const client = new GitHubClient(installationId, config.jwt);

  const repos: GitHubRepository[] = [];
  let page = 1;
  for (;;) {
    const { data, total } = await client.listRepositories(page, 100);
    repos.push(...data);
    if (repos.length >= total || data.length < 100 || repos.length >= limit) break;
    page += 1;
  }

  const now = new Date().toISOString();
  // Previous rows carry the owner's selection/visibility decisions forward.
  const { data: existingRows, error: selectErr } = await supabase
    .from('github_repositories')
    .select('github_repo_id, selected_for_evidence, show_publicly')
    .eq('connection_id', connectionId);
  if (selectErr) return { ok: false, reason: 'github_error' };
  const previous = new Map<number, { selected_for_evidence: boolean; show_publicly: boolean }>();
  for (const row of (existingRows ?? []) as Array<{
    github_repo_id: number;
    selected_for_evidence: boolean;
    show_publicly: boolean;
  }>) {
    previous.set(row.github_repo_id, {
      selected_for_evidence: row.selected_for_evidence,
      show_publicly: row.show_publicly,
    });
  }

  const rows = repos.slice(0, limit).map((repo) => {
    const prior = previous.get(repo.id);
    return {
      connection_id: connectionId,
      github_repo_id: repo.id,
      owner_login: repo.owner.login,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      is_private: repo.private,
      is_fork: repo.fork,
      is_archived: repo.archived,
      default_branch: repo.default_branch,
      primary_language: repo.language,
      topics: repo.topics,
      stars_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      github_created_at: repo.created_at,
      github_updated_at: repo.updated_at,
      github_pushed_at: repo.pushed_at,
      selected_for_evidence: prior?.selected_for_evidence ?? false,
      show_publicly: prior?.show_publicly ?? false,
      last_synced_at: now,
    };
  });

  const { error: upsertErr } = await supabase.from('github_repositories').upsert(rows);
  if (upsertErr) return { ok: false, reason: 'github_error' };

  return { ok: true, repositoriesSynced: rows.length, totalAvailable: repos.length };
}

// ─── Evidence pipeline (real, bounded, selected repos only) ─────────────

export interface EvidenceGenerationOutcome {
  ok: boolean;
  reason?: 'no_connection' | 'no_repositories' | 'github_error' | 'persist_error';
  repositoriesProcessed: number;
  evidenceExtracted: number;
  evidenceDeduped: number;
  staleRemoved: number;
  errors: string[];
}

/** Stable identity for dedupe across syncs. */
export function evidenceSourceKey(item: {
  evidence_type: string;
  source_url: string | null;
  source_commit_sha: string | null;
  subject: string;
}): string {
  return `${item.evidence_type}:${item.source_url ?? item.source_commit_sha ?? item.subject}`;
}

/**
 * REAL evidence generation for the SELECTED repositories of a connection.
 *
 * For each selected repo (bounded by config.syncLimits):
 *   1. fetch bounded commits / PRs / issues / releases via GitHubClient;
 *   2. run the production extraction functions (src/lib/github/evidence.ts);
 *   3. dedupe against existing rows by stable source identity;
 *   4. persist with profile_id + github_repository_id (FK by github_repo_id,
 *      so renames survive) and is_public = FALSE — nothing is auto-published.
 * Stale policy (explicit): evidence rows whose repository is no longer
 * selected are deleted at the start of generation; rows for still-selected
 * repos are replaced per source identity (upsert-by-dedupe, delete+insert).
 */
export async function generateEvidenceForSelected(params: {
  profileId: string;
  connectionId: string;
  installationId: number;
  config: GitHubModuleConfig;
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: unknown
        ) => PromiseLike<{ data: unknown; error: unknown }> & {
          eq: (col: string, val: unknown) => Promise<{ data: unknown; error: unknown }>;
        };
      };
      upsert: (rows: unknown, options?: unknown) => Promise<{ error: unknown }>;
      delete: () => {
        eq: (
          col: string,
          val: unknown
        ) => {
          eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
        };
      };
    };
  };
  tuning?: EvidenceTuning;
}): Promise<EvidenceGenerationOutcome> {
  const { profileId, connectionId, installationId, config, supabase } = params;
  const tuning =
    params.tuning ??
    ({
      ...DEFAULT_EVIDENCE_TUNING,
      ...config.evidence,
    } as EvidenceTuning);

  const outcome: EvidenceGenerationOutcome = {
    ok: true,
    repositoriesProcessed: 0,
    evidenceExtracted: 0,
    evidenceDeduped: 0,
    staleRemoved: 0,
    errors: [],
  };

  // 0. Load the selected repositories (rows persisted by the metadata sync).
  const { data: selectedRows, error: selectedError } = await supabase
    .from('github_repositories')
    .select('id, github_repo_id, owner_login, name, full_name')
    .eq('connection_id', connectionId)
    .eq('selected_for_evidence', true);
  if (selectedError) {
    return { ...outcome, ok: false, reason: 'github_error', errors: ['select_failed'] };
  }
  const selected = (selectedRows ?? []) as Array<{
    id: string;
    github_repo_id: number;
    owner_login: string;
    name: string;
    full_name: string;
  }>;

  // Stale policy: remove evidence rows for repositories that are no longer
  // selected (their source is gone from the owner's evidence set).
  const { data: staleRows, error: staleSelectError } = await supabase
    .from('profile_evidence')
    .select('id, github_repository_id')
    .eq('profile_id', profileId);
  if (staleSelectError) {
    return { ...outcome, ok: false, reason: 'persist_error', errors: ['stale_select_failed'] };
  }
  const selectedRepoRowIds = new Set(selected.map((r) => r.id));
  const staleIds = (
    (staleRows ?? []) as Array<{
      id: string;
      github_repository_id: string | null;
    }>
  )
    .filter(
      (r) => r.github_repository_id !== null && !selectedRepoRowIds.has(r.github_repository_id)
    )
    .map((r) => r.id);
  for (const id of staleIds) {
    // Double-keyed delete: id + profile_id (owner-scoped even here).
    const { error } = await supabase
      .from('profile_evidence')
      .delete()
      .eq('profile_id', profileId)
      .eq('id', id);
    if (!error) outcome.staleRemoved += 1;
  }

  if (selected.length === 0) {
    return outcome;
  }

  const client = new GitHubClient(installationId, config.jwt);

  for (const repo of selected) {
    try {
      const data = await client.syncAll(repo.owner_login, repo.name, {
        maxCommits: config.syncLimits.maxCommits,
        maxPullRequests: config.syncLimits.maxPullRequests,
        maxIssues: config.syncLimits.maxIssues,
        maxReleases: config.syncLimits.maxReleases,
      });

      // Production extraction functions — the same ones unit-tested directly.
      const commitResult = extractCommitsEvidence(data.commits, repo.id, repo.owner_login, tuning);
      const prResult = extractPullRequestsEvidence(data.pullRequests, repo.id);
      const issueResult = extractIssuesEvidence(data.issues, repo.id);
      const releaseResult = extractReleasesEvidence(data.releases, repo.id);

      const extracted: ProfileEvidence[] = [
        ...commitResult.evidence,
        ...prResult.evidence,
        ...issueResult.evidence,
        ...releaseResult.evidence,
      ];

      // Existing identities for this repo (stable source identity dedupe).
      const { data: existingRows, error: existingError } = await supabase
        .from('profile_evidence')
        .select('id, evidence_type, source_url, source_commit_sha, subject')
        .eq('profile_id', profileId)
        .eq('github_repository_id', repo.id);
      if (existingError) {
        outcome.errors.push(`existing:${repo.full_name}`);
        continue;
      }
      const existingIds = new Set(
        (
          (existingRows ?? []) as Array<{
            evidence_type: string;
            source_url: string | null;
            source_commit_sha: string | null;
            subject: string;
          }>
        ).map(evidenceSourceKey)
      );

      const fresh = extracted.filter((item) => {
        const key = evidenceSourceKey(item);
        if (existingIds.has(key)) {
          outcome.evidenceDeduped += 1;
          return false;
        }
        existingIds.add(key);
        return true;
      });

      if (fresh.length > 0) {
        const rows = fresh.map((item) => ({
          profile_id: profileId,
          github_repository_id: repo.id,
          evidence_type: item.evidence_type,
          subject: item.subject,
          summary: item.summary,
          source_path: null,
          source_url: item.source_url,
          source_commit_sha: item.source_commit_sha,
          metadata: item.metadata,
          is_public: false, // NEVER auto-publish.
          observed_at: item.observed_at,
        }));
        const { error: insertError } = await supabase.from('profile_evidence').upsert(rows, {
          onConflict: 'id',
          ignoreDuplicates: true,
        });
        if (insertError) {
          outcome.errors.push(`persist:${repo.full_name}`);
          continue;
        }
      }

      outcome.repositoriesProcessed += 1;
      outcome.evidenceExtracted += fresh.length;
    } catch (err) {
      outcome.errors.push(`${repo.full_name}: ${(err as Error).message}`);
    }
  }

  return outcome;
}

// Legacy re-export kept for the aggregate extractor's test consumers.
export { extractAllEvidence };

export { clearInstallationTokenCache };

// ─── Explicit selection round-trip (multiple installations) ─────────────
//
// When GET /user/installations returns MORE than one eligible installation,
// the user must choose. The chosen installation id is carried back in a
// server-signed, short-lived token (HMAC over installationId|userId|exp)
// issued together with the choice list — a browser-supplied installation id
// alone is never authority. The selection is STILL cross-verified with the
// App JWT before persisting.

const SELECTION_TTL_S = 600; // 10 minutes

export interface InstallationSelectionPayload {
  i: number; // installation id
  u: string; // CareerProfile Go user id
  e: number; // expiry (epoch seconds)
}

export function createSelectionToken(
  installationId: number,
  userId: string,
  config: GitHubModuleConfig
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: InstallationSelectionPayload = {
    i: installationId,
    u: userId,
    e: now + SELECTION_TTL_S,
  };
  const body = b64urlJson(payload);
  const sig = hmacB64url(makeStateSecret(config), body);
  return `${body}.${sig}`;
}

export function verifySelectionToken(
  token: string,
  config: GitHubModuleConfig,
  expectedUserId: string
): { ok: boolean; installationId?: number } {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false };
  const [body, sigRaw] = parts;
  const expected = hmacB64url(makeStateSecret(config), body);
  if (!safeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sigRaw, 'utf8'))) {
    return { ok: false };
  }
  const payload = fromB64urlJson<InstallationSelectionPayload>(body);
  if (!payload || typeof payload.i !== 'number' || typeof payload.u !== 'string') {
    return { ok: false };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.e < now) return { ok: false };
  if (payload.u !== expectedUserId) return { ok: false };
  return { ok: true, installationId: payload.i };
}

/**
 * App-JWT check that an installation exists on THIS app (no account match).
 * Used by the explicit selection round-trip where list membership was
 * already proven by the user access token at token-issuance time.
 */
export async function verifyInstallationOnApp(
  installationId: number,
  config: GitHubModuleConfig
): Promise<VerifiedInstallation | null> {
  const jwt = await appJwt(config);
  const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id: number;
    account: { login: string; id: number; type: string } | null;
  };
  if (!data.account) return null;
  return {
    installationId: data.id,
    accountLogin: data.account.login,
    accountId: data.account.id,
    accountType: data.account.type,
  };
}

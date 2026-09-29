import { createHmac, timingSafeEqual } from 'node:crypto';
import { clearInstallationTokenCache } from './installation';
import { isGitHubAppConfigured, loadGitHubConfig } from './config';
import { GitHubClient } from './client';
import type { GitHubRepository } from './types';

export interface GitHubServerEnv {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  GITHUB_STATE_SECRET?: string;
  GITHUB_APP_SLUG?: string;
  [key: string]: unknown;
}

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

export function makeStateSecret(env: GitHubServerEnv): string {
  return (
    env.GITHUB_STATE_SECRET ||
    `gh-state::${env.GITHUB_APP_ID || ''}::${env.GITHUB_APP_CLIENT_SECRET || ''}`
  );
}

export function createSignedState(userId: string, env: GitHubServerEnv): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: GitHubStatePayload = {
    u: userId,
    n: crypto.randomUUID(),
    t: now,
    e: now + STATE_TTL_S,
  };
  const body = b64urlJson(payload);
  const sig = hmacB64url(makeStateSecret(env), body);
  return `${body}.${sig}`;
}

export interface StateVerification {
  ok: boolean;
  reason?: 'malformed' | 'bad_signature' | 'expired' | 'user_mismatch';
  payload?: GitHubStatePayload;
}

export function verifySignedState(
  state: string,
  env: GitHubServerEnv,
  expectedUserId: string
): StateVerification {
  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [body, sigRaw] = parts;
  const expected = hmacB64url(makeStateSecret(env), body);
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

export function githubAppSlug(env: GitHubServerEnv): string | null {
  const slug = env.GITHUB_APP_SLUG || '';
  return slug.length > 0 ? slug : null;
}

/**
 * Public-safe, non-secret values the dashboard needs to render the install
 * entry point. Everything here is already public on a GitHub App listing.
 */
export function githubInstallInfo(env: GitHubServerEnv): {
  configured: boolean;
  slug: string | null;
  installUrl: string | null;
} {
  const configured = isGitHubAppConfigured() && Boolean(githubAppSlug(env));
  const slug = githubAppSlug(env);
  return {
    configured,
    slug,
    installUrl: configured && slug ? `https://github.com/apps/${slug}/installations/new` : null,
  };
}

// ─── Installation verification ────────────────────────────────
//
// A callback's `installation_id` query parameter is NEVER trusted on its
// own. GitHub's setup flow also returns the installing user; we verify the
// installation via the App JWT and cross-check that the installation's
// account matches the GitHub account authorized by the OAuth code exchange.

export interface VerifiedInstallation {
  installationId: number;
  accountLogin: string;
  accountId: number;
  accountType: string;
}

/** Fetches the authenticated App (GET /app) using the App JWT. */
async function appJwt(env: GitHubServerEnv): Promise<string> {
  const mod = await import('./jwt');
  const previousProcess = { ...process.env };
  try {
    // jwt.ts reads process.env directly; thread worker env values through
    // for this call only, then restore. Server-side only, single-threaded
    // per isolate event loop tick.
    for (const key of [
      'GITHUB_APP_ID',
      'GITHUB_APP_PRIVATE_KEY',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
    ] as const) {
      const value = env[key];
      if (typeof value === 'string' && value.length > 0) process.env[key] = value;
    }
    return await mod.getGitHubJWT();
  } finally {
    for (const key of Object.keys(previousProcess)) {
      if (!(key in process.env)) process.env[key] = previousProcess[key];
    }
  }
}

/** Verifies an installation exists and belongs to the given GitHub account. */
export async function verifyInstallationForAccount(
  installationId: number,
  expectedAccountId: number,
  env: GitHubServerEnv
): Promise<VerifiedInstallation | null> {
  const jwt = await appJwt(env);
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

/** Exchanges an OAuth code for the authorized GitHub user identity. */
export async function exchangeCodeForUser(
  code: string,
  env: GitHubServerEnv
): Promise<{ login: string; id: number; type: string } | null> {
  const config = loadGitHubConfig();
  const clientId = env.GITHUB_APP_CLIENT_ID || config.app.clientId;
  const clientSecret = env.GITHUB_APP_CLIENT_SECRET || config.app.clientSecret;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) return null;

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { login: string; id: number; type: string };
  return { login: user.login, id: user.id, type: user.type };
}

// ─── Sync ─────────────────────────────────────────────────────

export interface SyncOutcome {
  ok: boolean;
  reason?: 'not_configured' | 'no_connection' | 'github_error';
  repositoriesSynced?: number;
  totalAvailable?: number;
}

/**
 * Lists the installation's repositories (bounded pagination), then upserts
 * github_repositories rows by github_repo_id. Owner data only; selection
 * and public flags are preserved from any previous rows.
 */
export async function syncConnectionRepositories(params: {
  connectionId: string;
  installationId: number;
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => Promise<{ data: unknown; error: unknown }>;
      };
      upsert: (rows: unknown) => Promise<{ error: unknown }>;
    };
  };
  maxRepositories?: number;
}): Promise<SyncOutcome> {
  const { connectionId, installationId, supabase, maxRepositories } = params;
  const limit = maxRepositories ?? loadGitHubConfig().syncLimits.maxRepositories;

  const client = new GitHubClient(installationId);

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

export { clearInstallationTokenCache };

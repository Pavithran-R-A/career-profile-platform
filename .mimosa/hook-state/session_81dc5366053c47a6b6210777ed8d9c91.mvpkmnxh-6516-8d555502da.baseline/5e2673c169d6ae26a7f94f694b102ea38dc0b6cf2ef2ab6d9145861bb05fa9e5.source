import { getGitHubJWT, type GitHubJwtConfig } from './jwt';
import type { InstallationTokenResult } from './types';

// ─── Types ────────────────────────────────────────────────────

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

// ─── In-Memory Token Cache ────────────────────────────────────
// Tokens are valid for 60 minutes; we refresh at 50 minutes. The cache is
// keyed by installation id only — the signing config is a per-deployment
// constant, so no cross-request config bleed is possible here.

const TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;
const tokenCache = new Map<number, TokenCacheEntry>();

// ─── Core ─────────────────────────────────────────────────────

function githubApiBase(): string {
  return 'https://api.github.com';
}

/**
 * Requests a fresh installation access token for the given installation ID.
 * The App JWT is signed with the EXPLICIT config (no process.env reads).
 */
export async function createInstallationToken(
  installationId: number,
  jwtConfig: GitHubJwtConfig
): Promise<InstallationTokenResult> {
  const jwt = await getGitHubJWT(jwtConfig);

  const response = await fetch(
    `${githubApiBase()}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to create installation token for ${installationId}: ` +
        `${response.status} ${response.statusText} – ${body}`
    );
  }

  const data = (await response.json()) as {
    token: string;
    expires_at: string;
    permissions: Record<string, string>;
    repository_selection: string;
    repositories: Array<{ id: number; name: string }>;
  };

  return {
    token: data.token,
    expires_at: data.expires_at,
    permissions: data.permissions,
    repositories: data.repositories ?? [],
  };
}

/**
 * Returns an installation access token, using an in-memory cache
 * when possible to avoid hitting GitHub rate limits.
 */
export async function getInstallationToken(
  installationId: number,
  jwtConfig: GitHubJwtConfig
): Promise<InstallationTokenResult> {
  const cached = tokenCache.get(installationId);

  if (cached && Date.now() < cached.expiresAt) {
    return {
      token: cached.token,
      expires_at: new Date(cached.expiresAt).toISOString(),
      permissions: {},
      repositories: [],
    };
  }

  const result = await createInstallationToken(installationId, jwtConfig);
  const expiresAtMs = Date.now() + TOKEN_CACHE_TTL_MS;

  tokenCache.set(installationId, {
    token: result.token,
    expiresAt: expiresAtMs,
  });

  return result;
}

/**
 * Removes a cached token (call after auth errors).
 */
export function clearInstallationTokenCache(installationId?: number): void {
  if (installationId !== undefined) {
    tokenCache.delete(installationId);
  } else {
    tokenCache.clear();
  }
}

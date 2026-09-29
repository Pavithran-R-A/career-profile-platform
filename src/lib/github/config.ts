import type { GitHubAppConfig } from './types';

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_SYNC_LIMITS = {
  maxCommits: 100,
  maxPullRequests: 50,
  maxIssues: 50,
  maxReleases: 20,
  maxRepositories: 100,
} as const;

const DEFAULT_EVIDENCE = {
  minCommitMessageLength: 10,
  excludeMergeCommits: true,
  excludeBotCommits: true,
  excludeBuiltinBotNames: ['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]'],
  classifyConventionalCommits: true,
} as const;

// ─── Types ────────────────────────────────────────────────────

export interface SyncLimits {
  maxCommits: number;
  maxPullRequests: number;
  maxIssues: number;
  maxReleases: number;
  maxRepositories: number;
}

export interface EvidenceConfig {
  minCommitMessageLength: number;
  excludeMergeCommits: boolean;
  excludeBotCommits: boolean;
  excludeBuiltinBotNames: string[];
  classifyConventionalCommits: boolean;
}

export interface GitHubModuleConfig {
  app: GitHubAppConfig;
  syncLimits: SyncLimits;
  evidence: EvidenceConfig;
}

// ─── Environment Loading ──────────────────────────────────────

function optionalEnv(name: string, fallback: string): string {
  // Works in both Workers (env bindings are threaded into process.env shim
  // by workerd's compatibility layer) and Node test runs.
  const value = typeof process !== 'undefined' ? process.env[name] : undefined;
  return value ?? fallback;
}

function intEnv(name: string, fallback: number): number {
  const raw = optionalEnv(name, '');
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ─── Config Factory ───────────────────────────────────────────

let cachedConfig: GitHubModuleConfig | null = null as GitHubModuleConfig | null;

/**
 * Loads the GitHub App module config WITHOUT throwing when credentials are
 * absent — the audit requires truthful "not configured" behavior rather than
 * crashes. Callers that require credentials must check `isConfigured()`
 * first and degrade gracefully.
 */
export function loadGitHubConfig(): GitHubModuleConfig {
  if (cachedConfig) return cachedConfig;

  const appId = optionalEnv('GITHUB_APP_ID', '');
  const privateKey = optionalEnv('GITHUB_APP_PRIVATE_KEY', '').replace(/\\n/g, '\n');
  const clientId = optionalEnv('GITHUB_APP_CLIENT_ID', '');
  const clientSecret = optionalEnv('GITHUB_APP_CLIENT_SECRET', '');

  const config: GitHubModuleConfig = {
    app: {
      appId: Number.isFinite(parseInt(appId, 10)) && appId !== '' ? parseInt(appId, 10) : 0,
      privateKey,
      clientId,
      clientSecret,
      webhookSecret: optionalEnv('GITHUB_APP_WEBHOOK_SECRET', ''),
    },
    syncLimits: {
      maxCommits: intEnv('GITHUB_SYNC_MAX_COMMITS', DEFAULT_SYNC_LIMITS.maxCommits),
      maxPullRequests: intEnv('GITHUB_SYNC_MAX_PRS', DEFAULT_SYNC_LIMITS.maxPullRequests),
      maxIssues: intEnv('GITHUB_SYNC_MAX_ISSUES', DEFAULT_SYNC_LIMITS.maxIssues),
      maxReleases: intEnv('GITHUB_SYNC_MAX_RELEASES', DEFAULT_SYNC_LIMITS.maxReleases),
      maxRepositories: intEnv('GITHUB_SYNC_MAX_REPOS', DEFAULT_SYNC_LIMITS.maxRepositories),
    },
    evidence: {
      minCommitMessageLength: intEnv(
        'GITHUB_EVIDENCE_MIN_MSG_LEN',
        DEFAULT_EVIDENCE.minCommitMessageLength
      ),
      excludeMergeCommits: optionalEnv('GITHUB_EVIDENCE_EXCLUDE_MERGES', 'true') === 'true',
      excludeBotCommits: optionalEnv('GITHUB_EVIDENCE_EXCLUDE_BOTS', 'true') === 'true',
      excludeBuiltinBotNames: [...DEFAULT_EVIDENCE.excludeBuiltinBotNames],
      classifyConventionalCommits: optionalEnv('GITHUB_EVIDENCE_CONVENTIONAL', 'true') === 'true',
    },
  };

  cachedConfig = config;
  return config;
}

/**
 * Truthful configuration probe: the App can act on GitHub only when the
 * signing identity (appId + privateKey) exists. OAuth-only fields are not
 * required for installation-token flows.
 */
export function isGitHubAppConfigured(): boolean {
  const { app } = loadGitHubConfig();
  return Boolean(app.appId > 0 && app.privateKey);
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

export const SYNC_LIMITS = DEFAULT_SYNC_LIMITS;
export const EVIDENCE_CONFIG = DEFAULT_EVIDENCE;

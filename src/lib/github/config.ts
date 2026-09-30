/**
 * Explicit, immutable GitHub configuration.
 *
 * The ONLY entry point is `resolveGitHubConfig(env)`: it derives an
 * immutable config object from the request's Env bindings. No module in the
 * GitHub integration reads process.env for configuration, so concurrent
 * requests with different environments cannot bleed configuration into each
 * other (the old withGitHubEnv/process.env mutation is gone).
 */
import type { GitHubAppConfig } from './types';
import type { GitHubJwtConfig } from './jwt';

export interface GitHubSyncLimits {
  maxCommits: number;
  maxPullRequests: number;
  maxIssues: number;
  maxReleases: number;
  maxRepositories: number;
}

export interface GitHubEvidenceConfig {
  minCommitMessageLength: number;
  excludeMergeCommits: boolean;
  excludeBotCommits: boolean;
  excludeBuiltinBotNames: string[];
  classifyConventionalCommits: boolean;
}

export interface GitHubModuleConfig {
  app: GitHubAppConfig;
  stateSecret: string;
  appSlug: string;
  syncLimits: GitHubSyncLimits;
  evidence: GitHubEvidenceConfig;
  /** Signing identity for App JWTs (appId + private key only). */
  jwt: GitHubJwtConfig;
}

/** Minimal env shape the GitHub integration needs (worker Env or test env). */
export interface GitHubEnvSource {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  GITHUB_STATE_SECRET?: string;
  GITHUB_APP_SLUG?: string;
  GITHUB_SYNC_MAX_COMMITS?: string;
  GITHUB_SYNC_MAX_PRS?: string;
  GITHUB_SYNC_MAX_ISSUES?: string;
  GITHUB_SYNC_MAX_RELEASES?: string;
  GITHUB_SYNC_MAX_REPOS?: string;
  GITHUB_EVIDENCE_MIN_MSG_LEN?: string;
  GITHUB_EVIDENCE_EXCLUDE_MERGES?: string;
  GITHUB_EVIDENCE_EXCLUDE_BOTS?: string;
  GITHUB_EVIDENCE_CONVENTIONAL?: string;
  [key: string]: unknown;
}

const DEFAULT_SYNC_LIMITS: GitHubSyncLimits = {
  maxCommits: 100,
  maxPullRequests: 50,
  maxIssues: 50,
  maxReleases: 20,
  maxRepositories: 100,
};

const DEFAULT_BUILTIN_BOTS = ['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]'];

const DEFAULT_EVIDENCE: GitHubEvidenceConfig = {
  minCommitMessageLength: 10,
  excludeMergeCommits: true,
  excludeBotCommits: true,
  excludeBuiltinBotNames: [...DEFAULT_BUILTIN_BOTS],
  classifyConventionalCommits: true,
};

function optionalEnv(env: GitHubEnvSource, name: string, fallback: string): string {
  const value = env[name];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function intEnv(env: GitHubEnvSource, name: string, fallback: number): number {
  const raw = optionalEnv(env, name, '');
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolEnv(env: GitHubEnvSource, name: string, fallback: boolean): boolean {
  const raw = optionalEnv(env, name, '');
  if (!raw) return fallback;
  return raw === 'true' || raw === '1';
}

/**
 * Derives an immutable config from the request's Env. Called per request —
 * the returned object is a plain snapshot; callers must not mutate it.
 */
export function resolveGitHubConfig(env: GitHubEnvSource): GitHubModuleConfig {
  const appIdRaw = optionalEnv(env, 'GITHUB_APP_ID', '');
  const appId =
    Number.isFinite(parseInt(appIdRaw, 10)) && appIdRaw !== '' ? parseInt(appIdRaw, 10) : 0;
  const privateKey = optionalEnv(env, 'GITHUB_APP_PRIVATE_KEY', '').replace(/\\n/g, '\n');

  return {
    app: {
      appId,
      privateKey,
      clientId: optionalEnv(env, 'GITHUB_APP_CLIENT_ID', ''),
      clientSecret: optionalEnv(env, 'GITHUB_APP_CLIENT_SECRET', ''),
      // Webhooks are not implemented (docs removed in this pass); the field
      // stays on the shared type for future use and is always empty here.
      webhookSecret: '',
    },
    stateSecret: optionalEnv(env, 'GITHUB_STATE_SECRET', ''),
    appSlug: optionalEnv(env, 'GITHUB_APP_SLUG', ''),
    syncLimits: {
      maxCommits: intEnv(env, 'GITHUB_SYNC_MAX_COMMITS', DEFAULT_SYNC_LIMITS.maxCommits),
      maxPullRequests: intEnv(env, 'GITHUB_SYNC_MAX_PRS', DEFAULT_SYNC_LIMITS.maxPullRequests),
      maxIssues: intEnv(env, 'GITHUB_SYNC_MAX_ISSUES', DEFAULT_SYNC_LIMITS.maxIssues),
      maxReleases: intEnv(env, 'GITHUB_SYNC_MAX_RELEASES', DEFAULT_SYNC_LIMITS.maxReleases),
      maxRepositories: intEnv(env, 'GITHUB_SYNC_MAX_REPOS', DEFAULT_SYNC_LIMITS.maxRepositories),
    },
    evidence: {
      minCommitMessageLength: intEnv(
        env,
        'GITHUB_EVIDENCE_MIN_MSG_LEN',
        DEFAULT_EVIDENCE.minCommitMessageLength
      ),
      excludeMergeCommits: boolEnv(env, 'GITHUB_EVIDENCE_EXCLUDE_MERGES', true),
      excludeBotCommits: boolEnv(env, 'GITHUB_EVIDENCE_EXCLUDE_BOTS', true),
      excludeBuiltinBotNames: [...DEFAULT_EVIDENCE.excludeBuiltinBotNames],
      classifyConventionalCommits: boolEnv(env, 'GITHUB_EVIDENCE_CONVENTIONAL', true),
    },
    jwt: { appId: appIdRaw, privateKey },
  };
}

/** Truthful configuration probe: can the App sign JWTs and act on GitHub? */
export function isGitHubAppConfigured(config: GitHubModuleConfig): boolean {
  return Boolean(config.app.appId > 0 && config.app.privateKey);
}

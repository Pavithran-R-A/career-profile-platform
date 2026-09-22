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

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Configure it in your .env file or deployment settings.'
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ─── Config Factory ───────────────────────────────────────────

let cachedConfig: GitHubModuleConfig | null = null as GitHubModuleConfig | null;

export function loadGitHubConfig(): GitHubModuleConfig {
  if (cachedConfig) return cachedConfig;

  const appId = parseInt(requiredEnv('GITHUB_APP_ID'), 10);
  if (!Number.isFinite(appId) || appId <= 0) {
    throw new Error('GITHUB_APP_ID must be a positive integer');
  }

  const config: GitHubModuleConfig = {
    app: {
      appId,
      privateKey: requiredEnv('GITHUB_APP_PRIVATE_KEY'),
      clientId: requiredEnv('GITHUB_APP_CLIENT_ID'),
      clientSecret: requiredEnv('GITHUB_APP_CLIENT_SECRET'),
      webhookSecret: requiredEnv('GITHUB_APP_WEBHOOK_SECRET'),
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

export function resetConfigCache(): void {
  cachedConfig = null;
}

export const SYNC_LIMITS = DEFAULT_SYNC_LIMITS;
export const EVIDENCE_CONFIG = DEFAULT_EVIDENCE;

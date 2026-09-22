import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubIssue,
  GitHubRelease,
  GitHubCodeReview,
  GitHubRepositoryRecord,
  ProfileEvidence,
  SyncResult,
} from './types';
import type { GitHubClient } from './client';
import { loadGitHubConfig } from './config';
import {
  getClientForConnection,
  getConnection,
  findByInstallationId,
  updateConnectionStatus,
  syncRepositoryRecords,
  getRepositoryRecords,
} from './connection';
import {
  extractCommitsEvidence,
  extractPullRequestsEvidence,
  extractIssuesEvidence,
  extractReleasesEvidence,
  extractCodeReviewsEvidence,
} from './evidence';

// ─── Types ────────────────────────────────────────────────────

export interface SyncJobResult {
  connectionId: string;
  profileId: string;
  repositoriesSynced: number;
  evidenceExtracted: number;
  totalCommits: number;
  totalPullRequests: number;
  totalIssues: number;
  totalReleases: number;
  totalCodeReviews: number;
  errors: string[];
  durationMs: number;
}

export interface RepoSyncDetail {
  repository: GitHubRepositoryRecord;
  commitsSynced: number;
  pullRequestsSynced: number;
  issuesSynced: number;
  releasesSynced: number;
  codeReviewsSynced: number;
  evidenceExtracted: number;
  errors: string[];
}

export interface RepositorySyncInput {
  owner: string;
  name: string;
  githubRepoId: string;
  defaultBranch: string;
  lastSyncedAt?: string;
}

// ─── In-Memory Evidence Store ─────────────────────────────────

const evidenceStore = new Map<string, ProfileEvidence[]>();

export function getEvidenceForProfile(profileId: string): ProfileEvidence[] {
  return evidenceStore.get(profileId) ?? [];
}

export function clearEvidenceForProfile(profileId: string): void {
  evidenceStore.delete(profileId);
}

// ─── Sync Engine ──────────────────────────────────────────────

export class SyncEngine {
  private client: GitHubClient;
  private connectionId: string;
  private profileId: string;
  private config = loadGitHubConfig();
  private errors: string[] = [];

  constructor(connectionId: string) {
    const conn = getConnection(connectionId);
    if (!conn) throw new Error(`Connection ${connectionId} not found`);

    this.connectionId = connectionId;
    this.profileId = conn.profile_id;
    this.client = getClientForConnection(connectionId);
  }

  // ── Public API ──────────────────────────────────────────

  async syncFull(): Promise<SyncJobResult> {
    const start = Date.now();
    await updateConnectionStatus(this.connectionId, 'active');

    try {
      const repos = await this.syncRepositories();
      const repoDetails: RepoSyncDetail[] = [];

      for (const repo of repos) {
        if (!repo.selected_for_evidence) continue;
        const detail = await this.syncRepository(repo);
        repoDetails.push(detail);
      }

      const totalEvidence = repoDetails.reduce((sum, d) => sum + d.evidenceExtracted, 0);

      await updateConnectionStatus(this.connectionId, 'active', {
        last_synced_at: new Date().toISOString(),
        last_sync_status: 'success',
      });

      return {
        connectionId: this.connectionId,
        profileId: this.profileId,
        repositoriesSynced: repoDetails.length,
        evidenceExtracted: totalEvidence,
        totalCommits: repoDetails.reduce((s, d) => s + d.commitsSynced, 0),
        totalPullRequests: repoDetails.reduce((s, d) => s + d.pullRequestsSynced, 0),
        totalIssues: repoDetails.reduce((s, d) => s + d.issuesSynced, 0),
        totalReleases: repoDetails.reduce((s, d) => s + d.releasesSynced, 0),
        totalCodeReviews: repoDetails.reduce((s, d) => s + d.codeReviewsSynced, 0),
        errors: this.errors,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      await updateConnectionStatus(this.connectionId, 'error', {
        last_sync_status: 'error',
        last_error_code: (err as Error).message,
      });
      throw err;
    }
  }

  async syncSingleRepo(repoInput: RepositorySyncInput): Promise<RepoSyncDetail> {
    const record: GitHubRepositoryRecord = {
      id: '',
      connection_id: this.connectionId,
      github_repo_id: parseInt(repoInput.githubRepoId, 10),
      owner_login: repoInput.owner,
      name: repoInput.name,
      full_name: `${repoInput.owner}/${repoInput.name}`,
      description: null,
      html_url: `https://github.com/${repoInput.owner}/${repoInput.name}`,
      is_private: false,
      is_fork: false,
      is_archived: false,
      default_branch: repoInput.defaultBranch,
      primary_language: null,
      languages: [],
      topics: [],
      stars_count: 0,
      forks_count: 0,
      github_created_at: null,
      github_updated_at: null,
      github_pushed_at: null,
      default_branch_sha: null,
      selected_for_evidence: true,
      show_publicly: true,
      last_synced_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return this.syncRepository(record, repoInput.lastSyncedAt);
  }

  // ── Repository Sync ─────────────────────────────────────

  private async syncRepositories(): Promise<GitHubRepositoryRecord[]> {
    try {
      const remoteRepos = await this.client.getAllRepositories();
      const limit = this.config.syncLimits.maxRepositories;
      const sliced = remoteRepos.slice(0, limit);
      return syncRepositoryRecords(this.connectionId, sliced);
    } catch (err) {
      const msg = `Failed to list repositories: ${(err as Error).message}`;
      this.errors.push(msg);
      return getRepositoryRecords(this.connectionId);
    }
  }

  private async syncRepository(
    repo: GitHubRepositoryRecord,
    lastSyncedAt?: string
  ): Promise<RepoSyncDetail> {
    const detail: RepoSyncDetail = {
      repository: repo,
      commitsSynced: 0,
      pullRequestsSynced: 0,
      issuesSynced: 0,
      releasesSynced: 0,
      codeReviewsSynced: 0,
      evidenceExtracted: 0,
      errors: [],
    };

    const since = lastSyncedAt ?? repo.last_synced_at ?? undefined;

    const commits = await this.fetchCommits(repo, since, detail);
    const pullRequests = await this.fetchPullRequests(repo, detail);
    const issues = await this.fetchIssues(repo, detail);
    const releases = await this.fetchReleases(repo, detail);
    const codeReviews = await this.fetchCodeReviews(repo, pullRequests, detail);

    const allEvidence = this.extractEvidence(
      commits,
      pullRequests,
      issues,
      releases,
      codeReviews,
      repo
    );

    detail.evidenceExtracted = allEvidence.length;
    this.storeEvidence(allEvidence);

    return detail;
  }

  // ── Data Fetching ───────────────────────────────────────

  private async fetchCommits(
    repo: GitHubRepositoryRecord,
    since: string | undefined,
    detail: RepoSyncDetail
  ): Promise<GitHubCommit[]> {
    const limit = this.config.syncLimits.maxCommits;
    try {
      const commits = await this.client.listCommits(
        repo.owner_login,
        repo.name,
        repo.default_branch,
        since,
        Math.min(limit, 100)
      );
      detail.commitsSynced = commits.length;
      return commits;
    } catch (err) {
      const msg = `${repo.full_name} commits: ${(err as Error).message}`;
      detail.errors.push(msg);
      this.errors.push(msg);
      return [];
    }
  }

  private async fetchPullRequests(
    repo: GitHubRepositoryRecord,
    detail: RepoSyncDetail
  ): Promise<GitHubPullRequest[]> {
    const limit = this.config.syncLimits.maxPullRequests;
    try {
      const prs = await this.client.listPullRequests(
        repo.owner_login,
        repo.name,
        'all',
        Math.min(limit, 100)
      );
      detail.pullRequestsSynced = prs.length;
      return prs;
    } catch (err) {
      const msg = `${repo.full_name} PRs: ${(err as Error).message}`;
      detail.errors.push(msg);
      this.errors.push(msg);
      return [];
    }
  }

  private async fetchIssues(
    repo: GitHubRepositoryRecord,
    detail: RepoSyncDetail
  ): Promise<GitHubIssue[]> {
    const limit = this.config.syncLimits.maxIssues;
    try {
      const issues = await this.client.listIssues(
        repo.owner_login,
        repo.name,
        'all',
        Math.min(limit, 100)
      );
      detail.issuesSynced = issues.length;
      return issues;
    } catch (err) {
      const msg = `${repo.full_name} issues: ${(err as Error).message}`;
      detail.errors.push(msg);
      this.errors.push(msg);
      return [];
    }
  }

  private async fetchReleases(
    repo: GitHubRepositoryRecord,
    detail: RepoSyncDetail
  ): Promise<GitHubRelease[]> {
    const limit = this.config.syncLimits.maxReleases;
    try {
      const releases = await this.client.listReleases(
        repo.owner_login,
        repo.name,
        Math.min(limit, 100)
      );
      detail.releasesSynced = releases.length;
      return releases;
    } catch (err) {
      const msg = `${repo.full_name} releases: ${(err as Error).message}`;
      detail.errors.push(msg);
      this.errors.push(msg);
      return [];
    }
  }

  private async fetchCodeReviews(
    repo: GitHubRepositoryRecord,
    pullRequests: GitHubPullRequest[],
    detail: RepoSyncDetail
  ): Promise<GitHubCodeReview[]> {
    const allReviews: GitHubCodeReview[] = [];
    const maxReviews = 30;

    const prsToReview = pullRequests
      .filter((pr) => pr.state === 'closed' || pr.merged)
      .slice(0, Math.min(maxReviews, pullRequests.length));

    for (const pr of prsToReview) {
      try {
        const reviews = await this.client.listPullRequestReviews(
          repo.owner_login,
          repo.name,
          pr.number
        );
        allReviews.push(...reviews);
      } catch {
        // Reviews endpoint may be unavailable for some repos; silently skip
      }
    }

    detail.codeReviewsSynced = allReviews.length;
    return allReviews;
  }

  // ── Evidence Extraction ─────────────────────────────────

  private extractEvidence(
    commits: GitHubCommit[],
    pullRequests: GitHubPullRequest[],
    issues: GitHubIssue[],
    releases: GitHubRelease[],
    codeReviews: GitHubCodeReview[],
    repo: GitHubRepositoryRecord
  ): ProfileEvidence[] {
    const allEvidence: ProfileEvidence[] = [];

    const commitResult = extractCommitsEvidence(commits, repo.id, repo.owner_login);
    allEvidence.push(...commitResult.evidence);

    const prResult = extractPullRequestsEvidence(pullRequests, repo.id);
    allEvidence.push(...prResult.evidence);

    const issueResult = extractIssuesEvidence(issues, repo.id);
    allEvidence.push(...issueResult.evidence);

    const releaseResult = extractReleasesEvidence(releases, repo.id);
    allEvidence.push(...releaseResult.evidence);

    const reviewResult = extractCodeReviewsEvidence(codeReviews, repo.id);
    allEvidence.push(...reviewResult.evidence);

    return allEvidence;
  }

  private storeEvidence(evidence: ProfileEvidence[]): void {
    const tagged = evidence.map((e) => ({
      ...e,
      profile_id: this.profileId,
    }));

    const existing = evidenceStore.get(this.profileId) ?? [];
    const merged = [...existing, ...tagged];
    evidenceStore.set(this.profileId, merged);
  }
}

// ─── Factory ──────────────────────────────────────────────────

export function createSyncEngine(connectionId: string): SyncEngine {
  return new SyncEngine(connectionId);
}

// ─── Webhook-Triggered Incremental Sync ───────────────────────

export async function handleWebhookSync(
  installationId: number,
  repoFullName: string
): Promise<RepoSyncDetail | null> {
  const conn = findByInstallationId(installationId);
  if (!conn || conn.status !== 'active') return null;

  const [owner, name] = repoFullName.split('/');
  if (!owner || !name) return null;

  const engine = createSyncEngine(conn.id);
  return engine.syncSingleRepo({
    owner,
    name,
    githubRepoId: repoFullName,
    defaultBranch: 'main',
  });
}

// ─── Convenience: Re-extract Evidence for a Repo ─────────────

export function reextractEvidence(connectionId: string, githubRepoId: string): ProfileEvidence[] {
  const conn = getConnection(connectionId);
  if (!conn) return [];

  return (evidenceStore.get(conn.profile_id) ?? []).filter(
    (e) => e.github_repository_id === githubRepoId
  );
}

// ─── Convenience: Get Sync Summary ───────────────────────────

export function getSyncSummary(profileId: string): {
  totalEvidence: number;
  byType: Record<string, number>;
} {
  const evidence = evidenceStore.get(profileId) ?? [];
  const byType: Record<string, number> = {};

  for (const item of evidence) {
    byType[item.evidence_type] = (byType[item.evidence_type] ?? 0) + 1;
  }

  return { totalEvidence: evidence.length, byType };
}

// ─── Re-export SyncResult for convenience ─────────────────────
export type { SyncResult };

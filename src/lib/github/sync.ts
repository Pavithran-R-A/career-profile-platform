import { GitHubClient } from './client';
import type { GitHubRepositoryRecord } from './types';

export interface SyncJobResult {
  repositoriesSynced: number;
  evidenceExtracted: number;
  errors: string[];
  durationMs: number;
}

export interface SyncProgress {
  phase: 'idle' | 'repositories' | 'evidence' | 'complete';
  current: number;
  total: number;
}

export class SyncEngine {
  private client: GitHubClient;
  private errors: string[] = [];
  private progress: SyncProgress = { phase: 'idle', current: 0, total: 0 };

  constructor(installationId: number) {
    this.client = new GitHubClient(installationId);
  }

  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  async syncRepository(repo: GitHubRepositoryRecord): Promise<SyncJobResult> {
    const start = Date.now();
    const result: SyncJobResult = {
      repositoriesSynced: 0,
      evidenceExtracted: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      const data = await this.client.syncAll(repo.owner_login, repo.name);
      result.repositoriesSynced = 1;
      result.evidenceExtracted =
        data.commits.length + data.pullRequests.length + data.issues.length + data.releases.length;
    } catch (err) {
      const msg = `${repo.full_name}: ${(err as Error).message}`;
      result.errors.push(msg);
      this.errors.push(msg);
    }

    result.durationMs = Date.now() - start;
    return result;
  }

  async syncAll(repos: GitHubRepositoryRecord[]): Promise<SyncJobResult> {
    const combined: SyncJobResult = {
      repositoriesSynced: 0,
      evidenceExtracted: 0,
      errors: [],
      durationMs: 0,
    };

    const start = Date.now();
    this.errors = [];
    this.progress = { phase: 'repositories', current: 0, total: repos.length };

    for (const repo of repos) {
      const result = await this.syncRepository(repo);
      combined.repositoriesSynced += result.repositoriesSynced;
      combined.evidenceExtracted += result.evidenceExtracted;
      combined.errors.push(...result.errors);
      this.progress = { ...this.progress, current: this.progress.current + 1 };
    }

    this.progress = { phase: 'complete', current: repos.length, total: repos.length };
    combined.durationMs = Date.now() - start;
    return combined;
  }
}

import type {
  GitHubUser,
  GitHubRepository,
  GitHubCommit,
  GitHubPullRequest,
  GitHubIssue,
  GitHubRelease,
  GitHubCodeReview,
  SyncResult,
} from './types';
import { getInstallationToken } from './installation';

function githubApiBase(): string {
  return 'https://api.github.com';
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${githubApiBase()}${path}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function githubFetchWithMeta<T>(
  path: string,
  token: string
): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(`${githubApiBase()}${path}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export class GitHubClient {
  private installationId: number;

  constructor(installationId: number) {
    this.installationId = installationId;
  }

  private async getToken(): Promise<string> {
    const result = await getInstallationToken(this.installationId);
    return result.token;
  }

  async getUser(): Promise<GitHubUser> {
    const token = await this.getToken();
    return githubFetch<GitHubUser>('/user', token);
  }

  async listRepositories(page = 1, perPage = 100): Promise<PaginatedResponse<GitHubRepository>> {
    const token = await this.getToken();
    const { data, headers } = await githubFetchWithMeta<{ repositories: GitHubRepository[] }>(
      `/installation/repositories?page=${page}&per_page=${perPage}`,
      token
    );
    const total = parseInt(headers.get('x-total-count') ?? '0', 10);
    return { data: data.repositories ?? data, total };
  }

  async getAllRepositories(): Promise<GitHubRepository[]> {
    const all: GitHubRepository[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data, total } = await this.listRepositories(page, perPage);
      all.push(...data);
      if (all.length >= total || data.length < perPage) break;
      page++;
    }

    return all;
  }

  async getRepository(owner: string, name: string): Promise<GitHubRepository> {
    const token = await this.getToken();
    return githubFetch<GitHubRepository>(`/repos/${owner}/${name}`, token);
  }

  async getRepositoryLanguages(owner: string, name: string): Promise<Record<string, number>> {
    const token = await this.getToken();
    return githubFetch<Record<string, number>>(`/repos/${owner}/${name}/languages`, token);
  }

  async getRepositoryTopics(owner: string, name: string): Promise<string[]> {
    const token = await this.getToken();
    const data = await githubFetch<{ names: string[] }>(`/repos/${owner}/${name}/topics`, token);
    return data.names || [];
  }

  async getDefaultBranchSha(owner: string, name: string, branch: string): Promise<string | null> {
    const token = await this.getToken();
    try {
      const data = await githubFetch<{ commit: { sha: string } }>(
        `/repos/${owner}/${name}/branches/${branch}`,
        token
      );
      return data.commit?.sha ?? null;
    } catch {
      return null;
    }
  }

  async listCommits(owner: string, name: string, page = 1, perPage = 30): Promise<GitHubCommit[]> {
    const token = await this.getToken();
    return githubFetch<GitHubCommit[]>(
      `/repos/${owner}/${name}/commits?page=${page}&per_page=${perPage}`,
      token
    );
  }

  async listPullRequests(
    owner: string,
    name: string,
    page = 1,
    perPage = 30
  ): Promise<GitHubPullRequest[]> {
    const token = await this.getToken();
    return githubFetch<GitHubPullRequest[]>(
      `/repos/${owner}/${name}/pulls?state=all&page=${page}&per_page=${perPage}`,
      token
    );
  }

  async listIssues(owner: string, name: string, page = 1, perPage = 30): Promise<GitHubIssue[]> {
    const token = await this.getToken();
    return githubFetch<GitHubIssue[]>(
      `/repos/${owner}/${name}/issues?state=all&page=${page}&per_page=${perPage}`,
      token
    );
  }

  async listReleases(owner: string, name: string, page = 1, perPage = 5): Promise<GitHubRelease[]> {
    const token = await this.getToken();
    return githubFetch<GitHubRelease[]>(
      `/repos/${owner}/${name}/releases?page=${page}&per_page=${perPage}`,
      token
    );
  }

  async getCodeReviews(owner: string, name: string, prNumber: number): Promise<GitHubCodeReview[]> {
    const token = await this.getToken();
    return githubFetch<GitHubCodeReview[]>(
      `/repos/${owner}/${name}/pulls/${prNumber}/reviews`,
      token
    );
  }

  async getFilePath(
    owner: string,
    name: string,
    path: string,
    ref?: string
  ): Promise<string | null> {
    const token = await this.getToken();
    try {
      const data = await githubFetch<{ content?: string }>(
        `/repos/${owner}/${name}/contents/${path}${ref ? `?ref=${ref}` : ''}`,
        token
      );
      return data.content ?? null;
    } catch {
      return null;
    }
  }

  async syncAll(owner: string, name: string): Promise<SyncResult> {
    const result: SyncResult = {
      commits: [],
      pullRequests: [],
      issues: [],
      releases: [],
      languages: {},
      topics: [],
      defaultBranchSha: null,
    };

    try {
      result.languages = await this.getRepositoryLanguages(owner, name);
      result.topics = await this.getRepositoryTopics(owner, name);

      const repo = await this.getRepository(owner, name);
      result.defaultBranchSha = await this.getDefaultBranchSha(owner, name, repo.default_branch);

      result.commits = await this.listCommits(owner, name, 1, 30);
      result.pullRequests = await this.listPullRequests(owner, name, 1, 30);
      result.issues = await this.listIssues(owner, name, 1, 30);
      result.releases = await this.listReleases(owner, name, 1, 5);
    } catch {
      // Sync errors are collected per-repo
    }

    return result;
  }
}

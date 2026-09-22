import { describe, it, expect } from 'vitest';
import type {
  ProfileEvidence,
  GitHubCommit,
  GitHubPullRequest,
  GitHubRelease,
} from '../../lib/github/types';

// ─── Evidence Extraction Helpers ──────────────────────────────

interface EvidenceExtractor {
  type: ProfileEvidence['evidence_type'];
  canHandle: (item: unknown) => boolean;
  extract: (
    item: unknown,
    repositoryFullName: string
  ) => Omit<
    ProfileEvidence,
    'id' | 'profile_id' | 'github_repository_id' | 'created_at' | 'updated_at'
  >;
}

const commitExtractor: EvidenceExtractor = {
  type: 'commit',
  canHandle: (item): item is GitHubCommit => {
    return typeof item === 'object' && item !== null && 'commit' in item && 'sha' in item;
  },
  extract: (item, repositoryFullName) => {
    const commit = item as GitHubCommit;
    return {
      evidence_type: 'commit',
      subject: commit.commit.message.split('\n')[0],
      summary: `Commit by ${commit.commit.author.name} in ${repositoryFullName}`,
      source_path: null,
      source_url: commit.html_url,
      source_commit_sha: commit.sha,
      metadata: {
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        message: commit.commit.message,
        verified: commit.commit.verification?.verified ?? false,
      },
      is_public: false,
      observed_at: commit.commit.author.date,
    };
  },
};

const pullRequestExtractor: EvidenceExtractor = {
  type: 'pull_request',
  canHandle: (item): item is GitHubPullRequest => {
    return (
      typeof item === 'object' &&
      item !== null &&
      'pull_request' in item === false &&
      'number' in item &&
      'merged' in item
    );
  },
  extract: (item, repositoryFullName) => {
    const pr = item as GitHubPullRequest;
    const status = pr.merged ? 'merged' : pr.state;
    return {
      evidence_type: 'pull_request',
      subject: pr.title,
      summary: `Pull request #${pr.number} ${status} in ${repositoryFullName} (+${pr.additions}/-${pr.deletions})`,
      source_path: null,
      source_url: pr.html_url,
      source_commit_sha: null,
      metadata: {
        number: pr.number,
        state: pr.state,
        merged: pr.merged,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        author: pr.user.login,
      },
      is_public: false,
      observed_at: pr.created_at,
    };
  },
};

const releaseExtractor: EvidenceExtractor = {
  type: 'release',
  canHandle: (item): item is GitHubRelease => {
    return (
      typeof item === 'object' && item !== null && 'tag_name' in item && 'published_at' in item
    );
  },
  extract: (item, repositoryFullName) => {
    const release = item as GitHubRelease;
    return {
      evidence_type: 'release',
      subject: release.name ?? release.tag_name,
      summary: `Release ${release.tag_name} published in ${repositoryFullName}`,
      source_path: null,
      source_url: release.html_url,
      source_commit_sha: null,
      metadata: {
        tag_name: release.tag_name,
        prerelease: release.prerelease,
        draft: release.draft,
        assets_count: release.assets.length,
        author: release.author.login,
      },
      is_public: false,
      observed_at: release.published_at,
    };
  },
};

const extractors: EvidenceExtractor[] = [commitExtractor, pullRequestExtractor, releaseExtractor];

function extractEvidence(
  item: unknown,
  repositoryFullName: string
): Omit<
  ProfileEvidence,
  'id' | 'profile_id' | 'github_repository_id' | 'created_at' | 'updated_at'
> | null {
  for (const extractor of extractors) {
    if (extractor.canHandle(item)) {
      return extractor.extract(item, repositoryFullName);
    }
  }
  return null;
}

// ─── Tests ────────────────────────────────────────────────────

describe('extractEvidence', () => {
  it('extracts evidence from a commit', () => {
    const commit: GitHubCommit = {
      sha: 'abc123def456',
      node_id: 'C_1',
      commit: {
        author: { name: 'Alice', email: 'alice@example.com', date: '2025-01-15T10:30:00Z' },
        committer: { name: 'Alice', email: 'alice@example.com', date: '2025-01-15T10:30:00Z' },
        message: 'feat: add user authentication\n\nImplemented JWT-based auth flow',
        tree: { sha: 'tree123', url: 'https://github.com' },
        url: 'https://github.com',
        comment_count: 0,
        verification: { verified: true, reason: 'valid', signature: 'sig', payload: 'payload' },
      },
      url: 'https://github.com',
      html_url: 'https://github.com/user/repo/commit/abc123',
      comments_url: 'https://github.com',
      author: null,
      committer: null,
      parents: [],
    };

    const result = extractEvidence(commit, 'user/repo');

    expect(result).not.toBeNull();
    expect(result!.evidence_type).toBe('commit');
    expect(result!.subject).toBe('feat: add user authentication');
    expect(result!.source_url).toBe('https://github.com/user/repo/commit/abc123');
    expect(result!.source_commit_sha).toBe('abc123def456');
    expect(result!.metadata).toMatchObject({
      author: 'Alice',
      verified: true,
    });
  });

  it('extracts evidence from a pull request', () => {
    const pr: GitHubPullRequest = {
      id: 1,
      node_id: 'PR_1',
      url: 'https://github.com',
      html_url: 'https://github.com/user/repo/pull/1',
      diff_url: 'https://github.com',
      patch_url: 'https://github.com',
      issue_url: 'https://github.com',
      number: 1,
      state: 'closed',
      locked: false,
      title: 'Add CI pipeline',
      user: {
        login: 'bob',
        id: 1,
        node_id: 'U_1',
        avatar_url: '',
        gravatar_id: '',
        url: '',
        html_url: '',
        type: 'User',
        site_admin: false,
        name: null,
        company: null,
        blog: null,
        location: null,
        email: null,
        bio: null,
        public_repos: 0,
        followers: 0,
        following: 0,
        created_at: '',
        updated_at: '',
      },
      body: 'Adds GitHub Actions workflow',
      created_at: '2025-01-10T08:00:00Z',
      updated_at: '2025-01-10T12:00:00Z',
      closed_at: '2025-01-10T12:00:00Z',
      merged_at: '2025-01-10T12:00:00Z',
      merge_commit_sha: 'merge123',
      head: { label: 'user:feature', ref: 'feature', sha: 'sha1', user: {} as any, repo: null },
      base: { label: 'user:main', ref: 'main', sha: 'sha2', user: {} as any, repo: {} as any },
      merged: true,
      mergeable: true,
      merged_by: null,
      additions: 45,
      deletions: 3,
      changed_files: 2,
    };

    const result = extractEvidence(pr, 'user/repo');

    expect(result).not.toBeNull();
    expect(result!.evidence_type).toBe('pull_request');
    expect(result!.subject).toBe('Add CI pipeline');
    expect(result!.source_url).toBe('https://github.com/user/repo/pull/1');
    expect(result!.metadata).toMatchObject({
      number: 1,
      merged: true,
      additions: 45,
      deletions: 3,
    });
  });

  it('extracts evidence from a release', () => {
    const release: GitHubRelease = {
      id: 10,
      node_id: 'R_10',
      tag_name: 'v2.0.0',
      target_commitish: 'main',
      name: 'Version 2.0.0',
      body: 'Major release with breaking changes',
      draft: false,
      prerelease: false,
      created_at: '2025-02-01T00:00:00Z',
      published_at: '2025-02-01T12:00:00Z',
      author: {
        login: 'carol',
        id: 2,
        node_id: 'U_2',
        avatar_url: '',
        gravatar_id: '',
        url: '',
        html_url: '',
        type: 'User',
        site_admin: false,
        name: null,
        company: null,
        blog: null,
        location: null,
        email: null,
        bio: null,
        public_repos: 0,
        followers: 0,
        following: 0,
        created_at: '',
        updated_at: '',
      },
      assets: [],
      tarball_url: 'https://github.com',
      zipball_url: 'https://github.com',
      html_url: 'https://github.com/user/repo/releases/tag/v2.0.0',
    };

    const result = extractEvidence(release, 'user/repo');

    expect(result).not.toBeNull();
    expect(result!.evidence_type).toBe('release');
    expect(result!.subject).toBe('Version 2.0.0');
    expect(result!.source_url).toBe('https://github.com/user/repo/releases/tag/v2.0.0');
    expect(result!.metadata).toMatchObject({
      tag_name: 'v2.0.0',
      prerelease: false,
    });
  });

  it('returns null for unsupported item types', () => {
    const result = extractEvidence({ unknown: true }, 'user/repo');
    expect(result).toBeNull();
  });

  it('returns null for null input', () => {
    const result = extractEvidence(null, 'user/repo');
    expect(result).toBeNull();
  });

  it('returns null for string input', () => {
    const result = extractEvidence('not an object', 'user/repo');
    expect(result).toBeNull();
  });

  it('truncates commit subject to first line', () => {
    const commit: GitHubCommit = {
      sha: 'abc123',
      node_id: 'C_1',
      commit: {
        author: { name: 'Alice', email: 'alice@example.com', date: '2025-01-15T10:30:00Z' },
        committer: { name: 'Alice', email: 'alice@example.com', date: '2025-01-15T10:30:00Z' },
        message: 'fix: resolve memory leak\n\nDetailed description\nMore details',
        tree: { sha: 'tree1', url: 'https://github.com' },
        url: 'https://github.com',
        comment_count: 0,
        verification: { verified: false, reason: 'unsigned', signature: null, payload: null },
      },
      url: 'https://github.com',
      html_url: 'https://github.com',
      comments_url: 'https://github.com',
      author: null,
      committer: null,
      parents: [],
    };

    const result = extractEvidence(commit, 'user/repo');

    expect(result!.subject).toBe('fix: resolve memory leak');
    expect(result!.subject).not.toContain('Detailed description');
  });

  it('handles commit without verification', () => {
    const commit: GitHubCommit = {
      sha: 'abc123',
      node_id: 'C_1',
      commit: {
        author: { name: 'Alice', email: 'alice@example.com', date: '2025-01-15T10:30:00Z' },
        committer: { name: 'Alice', email: 'alice@example.com', date: '2025-01-15T10:30:00Z' },
        message: 'update readme',
        tree: { sha: 'tree1', url: 'https://github.com' },
        url: 'https://github.com',
        comment_count: 0,
        verification: { verified: false, reason: 'unsigned', signature: null, payload: null },
      },
      url: 'https://github.com',
      html_url: 'https://github.com',
      comments_url: 'https://github.com',
      author: null,
      committer: null,
      parents: [],
    };

    const result = extractEvidence(commit, 'user/repo');
    expect(result!.metadata).toMatchObject({ verified: false });
  });
});

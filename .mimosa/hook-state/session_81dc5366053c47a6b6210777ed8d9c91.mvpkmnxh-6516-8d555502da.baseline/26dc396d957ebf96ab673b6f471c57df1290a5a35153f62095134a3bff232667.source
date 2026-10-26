// Tests import the REAL production extraction functions — no reimplemented
// extractor lives here (the old copy was deleted).
import { describe, it, expect } from 'vitest';
import {
  extractCommitsEvidence,
  extractPullRequestsEvidence,
  extractIssuesEvidence,
  extractReleasesEvidence,
  extractCodeReviewsEvidence,
  extractAllEvidence,
  classifyCommit,
  dedupeEvidence,
  inferLanguageFromPath,
  deduceSkillsFromEvidence,
  DEFAULT_EVIDENCE_TUNING,
  type EvidenceTuning,
} from '../../lib/github/evidence';
import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubIssue,
  GitHubRelease,
  GitHubCodeReview,
  ProfileEvidence,
} from '../../lib/github/types';

const TUNING: EvidenceTuning = { ...DEFAULT_EVIDENCE_TUNING };

function makeCommit(overrides: Partial<GitHubCommit> = {}): GitHubCommit {
  return {
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
    ...overrides,
  };
}

function makePullRequest(overrides: Partial<GitHubPullRequest> = {}): GitHubPullRequest {
  const user = {
    login: 'bob',
    id: 1,
    node_id: 'U_1',
    avatar_url: '',
    gravatar_id: '',
    url: '',
    html_url: '',
    type: 'User' as const,
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
  };
  return {
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
    user,
    body: null,
    created_at: '2025-02-01T09:00:00Z',
    updated_at: '2025-02-01T09:00:00Z',
    closed_at: '2025-02-02T09:00:00Z',
    merged_at: '2025-02-02T09:00:00Z',
    merge_commit_sha: null,
    head: { label: 'feature', ref: 'feature', sha: 'h1', user, repo: null },
    base: { label: 'main', ref: 'main', sha: 'b1', user, repo: null as never },
    merged: true,
    mergeable: null,
    merged_by: null,
    additions: 120,
    deletions: 15,
    changed_files: 4,
    ...overrides,
  };
}

function makeIssue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    id: 7,
    node_id: 'I_7',
    url: 'https://github.com',
    html_url: 'https://github.com/user/repo/issues/7',
    number: 7,
    state: 'open',
    title: 'Document the public API',
    body: null,
    user: makePullRequest().user,
    labels: [{ id: 1, name: 'docs', color: 'cccccc', description: null }],
    assignee: null,
    assignees: [],
    milestone: null,
    locked: false,
    created_at: '2025-03-01T08:00:00Z',
    updated_at: '2025-03-01T08:00:00Z',
    closed_at: null,
    comments: 2,
    ...overrides,
  };
}

function makeRelease(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    id: 9,
    node_id: 'R_9',
    tag_name: 'v1.2.0',
    target_commitish: 'main',
    name: 'Version 1.2.0',
    body: null,
    draft: false,
    prerelease: false,
    created_at: '2025-04-01T00:00:00Z',
    published_at: '2025-04-01T00:00:00Z',
    author: makePullRequest().user,
    assets: [],
    tarball_url: 'https://github.com/tar',
    zipball_url: 'https://github.com/zip',
    html_url: 'https://github.com/user/repo/releases/v1.2.0',
    ...overrides,
  };
}

describe('extractCommitsEvidence (real module)', () => {
  it('extracts evidence from a conventional commit', () => {
    const result = extractCommitsEvidence([makeCommit()], 'repo-row-1', 'user', TUNING);
    expect(result.evidence).toHaveLength(1);
    const item = result.evidence[0];
    expect(item.evidence_type).toBe('commit');
    expect(item.subject).toBe('[feat] add user authentication');
    expect(item.source_url).toBe('https://github.com/user/repo/commit/abc123');
    expect(item.source_commit_sha).toBe('abc123def456');
    expect(item.metadata.author_email).toBe('alice@example.com');
    expect(item.metadata.verified).toBe(true);
    expect(item.is_public).toBe(false);
  });

  it('skips merge commits when configured', () => {
    const merge = makeCommit({
      parents: [
        { sha: 'p1', url: '', html_url: '' },
        { sha: 'p2', url: '', html_url: '' },
      ],
    });
    const result = extractCommitsEvidence([merge], 'r', 'user', TUNING);
    expect(result.evidence).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it('skips bot commits', () => {
    const bot = makeCommit({
      author: {
        login: 'dependabot[bot]',
        id: 1,
        node_id: '',
        avatar_url: '',
        gravatar_id: '',
        url: '',
        html_url: '',
        type: 'Bot' as never,
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
    });
    const result = extractCommitsEvidence([bot], 'r', 'user', TUNING);
    expect(result.skipped).toBe(1);
  });

  it('skips short commit messages', () => {
    const short = makeCommit({
      commit: {
        ...makeCommit().commit,
        message: 'fix typo',
      },
    });
    const result = extractCommitsEvidence([short], 'r', 'user', {
      ...TUNING,
      minCommitMessageLength: 10,
    });
    expect(result.skipped).toBe(1);
  });
});

describe('extractPullRequestsEvidence (real module)', () => {
  it('extracts merged PR evidence', () => {
    const result = extractPullRequestsEvidence([makePullRequest()], 'repo-row-1');
    expect(result.evidence).toHaveLength(1);
    const item = result.evidence[0];
    expect(item.evidence_type).toBe('pull_request');
    expect(item.subject).toContain('Merged PR #1');
    expect(item.metadata.additions).toBe(120);
    expect(item.metadata.author_login).toBe('bob');
    expect(item.is_public).toBe(false);
  });

  it('labels open PRs', () => {
    const open = makePullRequest({
      state: 'open',
      merged: false,
      merged_at: null,
      closed_at: null,
    });
    const result = extractPullRequestsEvidence([open], 'repo-row-1');
    expect(result.evidence[0].subject).toContain('Open PR #1');
  });
});

describe('extractIssuesEvidence / extractReleasesEvidence (real module)', () => {
  it('extracts issue evidence with labels', () => {
    const result = extractIssuesEvidence([makeIssue()], 'repo-row-1');
    expect(result.evidence[0].evidence_type).toBe('issue');
    expect(result.evidence[0].metadata.labels).toEqual(['docs']);
  });

  it('extracts release evidence', () => {
    const result = extractReleasesEvidence([makeRelease()], 'repo-row-1');
    expect(result.evidence[0].evidence_type).toBe('release');
    expect(result.evidence[0].subject).toContain('v1.2.0');
    expect(result.evidence[0].metadata.tag_name).toBe('v1.2.0');
  });
});

describe('extractCodeReviewsEvidence (real module)', () => {
  it('extracts review evidence', () => {
    const review: GitHubCodeReview = {
      id: 11,
      node_id: 'CR_11',
      user: makePullRequest().user,
      body: null,
      commit_id: 'c11',
      submitted_at: '2025-05-01T00:00:00Z',
      state: 'approved',
      html_url: 'https://github.com/user/repo/pull/1#review',
      pull_request_url: 'https://github.com/user/repo/pull/1',
    };
    const result = extractCodeReviewsEvidence([review], 'repo-row-1');
    expect(result.evidence[0].evidence_type).toBe('code_review');
    expect(result.evidence[0].metadata.reviewer_login).toBe('bob');
  });
});

describe('extractAllEvidence (real module)', () => {
  it('routes each source type and dedupes stable identities', () => {
    const commit = makeCommit();
    const result = extractAllEvidence(
      [
        { type: 'commit', data: commit },
        { type: 'commit', data: makeCommit() }, // duplicate identity
        { type: 'pull_request', data: makePullRequest() },
        { type: 'issue', data: makeIssue() },
        { type: 'release', data: makeRelease() },
      ],
      'repo-row-1'
    );
    expect(result.evidence).toHaveLength(4);
    expect(result.evidence.map((e) => e.evidence_type)).toEqual([
      'commit',
      'pull_request',
      'issue',
      'release',
    ]);
    expect(result.skipped).toBe(0);
  });
});

describe('classifyCommit', () => {
  it('parses conventional commit headers', () => {
    expect(classifyCommit('feat(api): add tokens')).toEqual({
      type: 'feat',
      scope: 'api',
      description: 'add tokens',
      isBreaking: false,
    });
    expect(classifyCommit('fix!: crash on load').isBreaking).toBe(true);
  });

  it('falls back to unknown', () => {
    const result = classifyCommit('just some message');
    expect(result.type).toBe('unknown');
  });
});

describe('dedupeEvidence', () => {
  it('removes items with identical stable identities', () => {
    const base: ProfileEvidence = {
      id: '1',
      profile_id: 'p',
      github_repository_id: 'r',
      evidence_type: 'commit',
      subject: 's',
      summary: 'm',
      source_path: null,
      source_url: 'https://github.com/x/1',
      source_commit_sha: null,
      metadata: {},
      is_public: false,
      observed_at: '2025-01-01',
      created_at: '',
      updated_at: '',
    };
    expect(dedupeEvidence([base, { ...base }])).toHaveLength(1);
    expect(
      dedupeEvidence([base, { ...base, id: '2', source_url: 'https://github.com/x/2' }])
    ).toHaveLength(2);
  });
});

describe('path/skills helpers', () => {
  it('infers language from file extension', () => {
    expect(inferLanguageFromPath('src/main.ts')).toBe('TypeScript');
    expect(inferLanguageFromPath('app.py')).toBe('Python');
    expect(inferLanguageFromPath('unknownfile')).toBeNull();
  });

  it('deduces skills from commit scopes', () => {
    const items: ProfileEvidence[] = [
      {
        ...({
          id: '1',
          profile_id: 'p',
          github_repository_id: 'r',
          evidence_type: 'commit',
          subject: 's',
          summary: 'm',
          source_path: null,
          source_url: null,
          source_commit_sha: 'sha',
          metadata: {
            sha: 'sha',
            classification: { type: 'feat', scope: 'api', description: 'x', isBreaking: false },
          },
          is_public: false,
          observed_at: '',
          created_at: '',
          updated_at: '',
        } as unknown as ProfileEvidence),
      },
    ];
    const skills = deduceSkillsFromEvidence(items);
    expect(skills.get('api')).toBe(1);
  });
});

describe('pipeline defaults', () => {
  it('every extracted item defaults to is_public=false (nothing auto-publishes)', () => {
    const results = [
      extractCommitsEvidence([makeCommit()], 'r', 'user', TUNING),
      extractPullRequestsEvidence([makePullRequest()], 'r'),
      extractIssuesEvidence([makeIssue()], 'r'),
      extractReleasesEvidence([makeRelease()], 'r'),
    ];
    for (const result of results) {
      for (const item of result.evidence) {
        expect(item.is_public).toBe(false);
      }
    }
  });
});

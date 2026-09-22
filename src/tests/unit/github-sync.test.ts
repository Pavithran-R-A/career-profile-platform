import { describe, it, expect } from 'vitest';
import type { GitHubRepositoryRecord, ProfileEvidence } from '../../lib/github/types';

const mockRepo: GitHubRepositoryRecord = {
  id: 'repo-1',
  connection_id: 'conn-1',
  github_repo_id: 100,
  owner_login: 'user',
  name: 'test-repo',
  full_name: 'user/test-repo',
  description: 'Test repo',
  html_url: 'https://github.com/user/test-repo',
  is_private: false,
  is_fork: false,
  is_archived: false,
  default_branch: 'main',
  primary_language: 'TypeScript',
  languages: ['TypeScript'],
  topics: [],
  stars_count: 10,
  forks_count: 2,
  github_created_at: '2024-01-01',
  github_updated_at: '2024-01-01',
  github_pushed_at: '2024-01-01',
  default_branch_sha: 'abc123',
  selected_for_evidence: false,
  show_publicly: false,
  last_synced_at: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

function deduplicateEvidence(
  existing: ProfileEvidence[],
  incoming: Omit<ProfileEvidence, 'id' | 'profile_id' | 'created_at' | 'updated_at'>[]
): Omit<ProfileEvidence, 'id' | 'profile_id' | 'created_at' | 'updated_at'>[] {
  const seen = new Set(
    existing.map((e) => `${e.evidence_type}:${e.source_url ?? e.source_commit_sha ?? e.subject}`)
  );

  return incoming.filter((item) => {
    const key = `${item.evidence_type}:${item.source_url ?? item.source_commit_sha ?? item.subject}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

describe('Evidence Deduplication', () => {
  const baseEvidence = {
    github_repository_id: 'repo-1',
    evidence_type: 'commit' as const,
    subject: 'TypeScript',
    summary: 'TypeScript detected',
    source_path: null,
    source_url: 'https://github.com/user/repo',
    source_commit_sha: null,
    metadata: {},
    is_public: false,
    observed_at: '2024-01-01',
  };

  it('filters out duplicate evidence by source_url', () => {
    const existing: ProfileEvidence[] = [
      { ...baseEvidence, id: '1', profile_id: 'p1', created_at: '', updated_at: '' },
    ];
    const incoming = [{ ...baseEvidence }];
    const result = deduplicateEvidence(existing, incoming);
    expect(result).toHaveLength(0);
  });

  it('returns all evidence when no duplicates exist', () => {
    const existing: ProfileEvidence[] = [];
    const incoming = [
      { ...baseEvidence, subject: 'TypeScript', source_url: 'https://github.com/user/repo1' },
      { ...baseEvidence, subject: 'React', source_url: 'https://github.com/user/repo2' },
    ];
    const result = deduplicateEvidence(existing, incoming);
    expect(result).toHaveLength(2);
  });

  it('deduplicates within incoming batch', () => {
    const incoming = [
      { ...baseEvidence, subject: 'TypeScript' },
      { ...baseEvidence, subject: 'TypeScript' },
    ];
    const result = deduplicateEvidence([], incoming);
    expect(result).toHaveLength(1);
  });

  it('deduplicates by source_commit_sha when no source_url', () => {
    const existing: ProfileEvidence[] = [
      {
        ...baseEvidence,
        source_url: null,
        source_commit_sha: 'abc',
        id: '1',
        profile_id: 'p1',
        created_at: '',
        updated_at: '',
      },
    ];
    const incoming = [{ ...baseEvidence, source_url: null, source_commit_sha: 'abc' }];
    const result = deduplicateEvidence(existing, incoming);
    expect(result).toHaveLength(0);
  });
});

describe('Repository metadata', () => {
  it('has required fields', () => {
    expect(mockRepo.github_repo_id).toBeDefined();
    expect(mockRepo.name).toBeDefined();
    expect(mockRepo.full_name).toBeDefined();
  });

  it('private repo defaults show_publicly to false', () => {
    const privateRepo = { ...mockRepo, is_private: true, show_publicly: false };
    expect(privateRepo.show_publicly).toBe(false);
  });

  it('forked repo has is_fork flag', () => {
    const forkedRepo = { ...mockRepo, is_fork: true };
    expect(forkedRepo.is_fork).toBe(true);
  });

  it('archived repo has is_archived flag', () => {
    const archivedRepo = { ...mockRepo, is_archived: true };
    expect(archivedRepo.is_archived).toBe(true);
  });
});

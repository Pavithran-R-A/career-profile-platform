import { describe, it, expect } from 'vitest';
import { dedupeEvidence } from '../../lib/github/evidence';
import type { ProfileEvidence } from '../../lib/github/types';

// Tests the SHIPPED dedupe helper (src/lib/github/evidence.ts — the same
// function the evidence pipeline runs before persisting). No dedupe logic is
// copied here.

function evidence(overrides: Partial<ProfileEvidence> & { id: string }): ProfileEvidence {
  return {
    profile_id: '550e8400-e29b-41d4-a716-446655440000',
    github_repository_id: null,
    evidence_type: 'commit',
    subject: 'fix: something',
    summary: 'A summary',
    source_path: null,
    source_url: null,
    source_commit_sha: null,
    metadata: {},
    is_public: false,
    observed_at: '2026-09-01T00:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  } as ProfileEvidence;
}

describe('dedupeEvidence (production)', () => {
  it('deduplicates identical evidence_type + source_url', () => {
    const items = [
      evidence({ id: 'a', evidence_type: 'commit', source_url: 'https://github.com/o/r/commit/1' }),
      evidence({ id: 'b', evidence_type: 'commit', source_url: 'https://github.com/o/r/commit/1' }),
    ];
    const result = dedupeEvidence(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
  });

  it('keeps distinct evidence even from the same repository', () => {
    const items = [
      evidence({ id: 'a', source_url: 'https://github.com/o/r/commit/1' }),
      evidence({ id: 'b', source_url: 'https://github.com/o/r/commit/2' }),
    ];
    expect(dedupeEvidence(items)).toHaveLength(2);
  });

  it('treats different evidence types as distinct even with the same URL', () => {
    const items = [
      evidence({ id: 'a', evidence_type: 'commit', source_url: 'https://github.com/o/r/x' }),
      evidence({ id: 'b', evidence_type: 'pull_request', source_url: 'https://github.com/o/r/x' }),
    ];
    expect(dedupeEvidence(items)).toHaveLength(2);
  });

  it('falls back to commit sha when there is no URL', () => {
    const items = [
      evidence({ id: 'a', source_url: null, source_commit_sha: 'abc123' }),
      evidence({ id: 'b', source_url: null, source_commit_sha: 'abc123' }),
    ];
    const result = dedupeEvidence(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
  });

  it('falls back to subject when neither URL nor sha exists', () => {
    const items = [
      evidence({ id: 'a', source_url: null, source_commit_sha: null, subject: 'release v1' }),
      evidence({ id: 'b', source_url: null, source_commit_sha: null, subject: 'release v1' }),
    ];
    expect(dedupeEvidence(items)).toHaveLength(1);
  });

  it('handles an empty list', () => {
    expect(dedupeEvidence([])).toEqual([]);
  });

  it('preserves input order for the survivors', () => {
    const items = [
      evidence({ id: 'first', source_url: 'https://x/1' }),
      evidence({ id: 'dup', source_url: 'https://x/1' }),
      evidence({ id: 'last', source_url: 'https://x/2' }),
    ];
    const result = dedupeEvidence(items);
    expect(result.map((r) => r.id)).toEqual(['first', 'last']);
  });
});

import { describe, it, expect } from 'vitest';
import { profileCompletion } from '../../lib/profiles/completion';
import type { ProfileWithRelations } from '../../lib/profiles/repository';

function makeProfile(overrides: Partial<ProfileWithRelations> = {}): ProfileWithRelations {
  return {
    id: 'profile-id',
    user_id: 'user-1',
    username: 'synthetic',
    display_name: null,
    headline: null,
    about: null,
    location: null,
    avatar_url: null,
    visibility: 'draft',
    published_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    experiences: [],
    education: [],
    skills: [],
    projects: [],
    links: [],
    ...overrides,
  };
}

const row = { id: 'x', profile_id: 'profile-id', sort_order: 0, created_at: '', updated_at: '' };

describe('profileCompletion', () => {
  it('reports 0% for a bare profile with no display name', () => {
    const summary = profileCompletion(makeProfile());
    expect(summary.percentage).toBe(0);
    expect(summary.completedCount).toBe(0);
    expect(summary.items).toHaveLength(5);
  });

  it('marks Profile basics complete once onboarding basics are persisted', () => {
    const summary = profileCompletion(
      makeProfile({ display_name: 'Synthetic Candidate', headline: 'Engineer' })
    );
    expect(summary.items[0]).toEqual({ label: 'Profile basics', completed: true });
    expect(summary.percentage).toBe(20);
  });

  it('counts every section truthfully without inflation', () => {
    const summary = profileCompletion(
      makeProfile({
        display_name: 'Synthetic Candidate',
        experiences: [{ ...row, company: 'Acme', role: 'Dev' } as never],
        education: [{ ...row, institution: 'Uni' } as never],
        skills: [{ ...row, name: 'TypeScript' } as never],
        links: [{ ...row, label: 'GitHub', url: 'https://github.com/x' } as never],
      })
    );
    expect(summary.completedCount).toBe(5);
    expect(summary.percentage).toBe(100);
  });
});

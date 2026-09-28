import { describe, it, expect } from 'vitest';
import { buildReviewModel, REVIEW_SECTION_KEYS } from '../../lib/resume/review';
import type { ResumeExtraction } from '../../lib/ai/provider';
import type { ProfileWithRelations } from '../../lib/profiles/repository';

function draft(overrides: Partial<ResumeExtraction> = {}): ResumeExtraction {
  return {
    identity: {
      displayName: 'Ada Lovelace',
      headline: 'Engineer',
      location: 'London',
      about: 'Notes on computation.',
    },
    experience: [
      {
        company: 'Analytical Engines Ltd',
        role: 'Software Engineer',
        startDate: '2021-03',
        endDate: null,
        isCurrent: true,
        description: 'Built pipelines.',
      },
    ],
    education: [{ institution: 'University of London', degree: 'BSc Mathematics' }],
    projects: [{ name: 'Difference Engine CLI', url: 'https://github.com/ada/cli' }],
    skills: [{ name: 'TypeScript' }, { name: 'Rust' }],
    links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/ada' }],
    warnings: ['One date was ambiguous'],
    ...overrides,
  };
}

function profile(overrides: Partial<ProfileWithRelations> = {}): ProfileWithRelations {
  return {
    id: 'p1',
    user_id: 'u1',
    username: 'ada',
    display_name: 'Ada',
    headline: 'Engineer',
    about: 'Existing about',
    location: null,
    avatar_url: null,
    visibility: 'draft',
    published_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    experiences: [
      {
        id: 'e1',
        profile_id: 'p1',
        role: 'Analyst',
        company: 'Old Co',
        location: null,
        start_year: 2019,
        start_month: null,
        end_year: 2020,
        end_month: null,
        is_current: false,
        description: null,
        sort_order: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ],
    education: [],
    projects: [],
    skills: [
      {
        id: 's1',
        profile_id: 'p1',
        name: 'typescript',
        category: null,
        sort_order: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ],
    links: [
      {
        id: 'l1',
        profile_id: 'p1',
        label: 'LinkedIn',
        url: 'https://linkedin.com/in/ada/',
        sort_order: 0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ],
    ...overrides,
  } as ProfileWithRelations;
}

describe('buildReviewModel', () => {
  it('covers all six review sections in a stable order', () => {
    const model = buildReviewModel(null, draft());
    expect(model.sections.map((s) => s.key)).toEqual(REVIEW_SECTION_KEYS);
    expect(model.warnings).toEqual(['One date was ambiguous']);
  });

  it('marks every proposed section safe for an empty profile', () => {
    const model = buildReviewModel(null, draft());
    expect(model.safeKeys).toEqual([
      'identity',
      'experience',
      'education',
      'skills',
      'projects',
      'links',
    ]);
    expect(model.sections.every((s) => s.conflictNotes.length === 0)).toBe(true);
  });

  it('never marks an existing section safe to auto-apply', () => {
    const model = buildReviewModel(profile(), draft());
    expect(model.safeKeys).not.toContain('experience');
    const experience = model.sections.find((s) => s.key === 'experience');
    expect(experience?.existingCount).toBe(1);
    expect(experience?.conflictNotes[0]).toMatch(/already has 1 experience entry/);
  });

  it('keeps current values for conflicting basics and says so', () => {
    const model = buildReviewModel(profile(), draft());
    const identity = model.sections.find((s) => s.key === 'identity');
    // about differs ("Notes on computation." vs "Existing about"), display name differs too
    expect(identity?.conflictNotes.length).toBeGreaterThanOrEqual(1);
    expect(identity?.conflictNotes.join(' ')).toMatch(/already set/);
  });

  it('dedupes skills and links against existing content (case/URL-insensitive)', () => {
    const model = buildReviewModel(profile(), draft());
    const skills = model.sections.find((s) => s.key === 'skills');
    expect(skills?.conflictNotes[0]).toMatch(/1 proposed skill is already/);
    const links = model.sections.find((s) => s.key === 'links');
    expect(links?.conflictNotes[0]).toMatch(/1 proposed link is already/);
  });

  it('caps previews at three lines', () => {
    const model = buildReviewModel(
      null,
      draft({
        skills: Array.from({ length: 8 }, (_, i) => ({ name: `Skill ${i}` })),
      })
    );
    const skills = model.sections.find((s) => s.key === 'skills');
    expect(skills?.proposalPreview).toHaveLength(1);
    expect(skills?.proposalPreview[0].split(', ')).toHaveLength(8);
    expect(
      model.sections.find((s) => s.key === 'identity')?.proposalPreview.length
    ).toBeLessThanOrEqual(3);
  });

  it('reports zero proposal counts for empty sections', () => {
    const model = buildReviewModel(null, draft({ experience: [], projects: [] }));
    expect(model.sections.find((s) => s.key === 'experience')?.proposedCount).toBe(0);
    expect(model.sections.find((s) => s.key === 'projects')?.hasProposal).toBe(false);
    expect(model.safeKeys).not.toContain('experience');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildImportPayload,
  parseImportDate,
  applyResumeImport,
  type ResumeImportPayload,
} from '../../lib/resume/import';
import type { ResumeExtraction } from '../../lib/ai/provider';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from '../../lib/supabase/client';

function makeExtraction(overrides: Partial<ResumeExtraction> = {}): ResumeExtraction {
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
        location: 'London',
        startDate: '2021-03',
        endDate: null,
        isCurrent: true,
        description: 'Built computation pipelines.',
      },
    ],
    education: [
      {
        institution: 'University of London',
        degree: 'BSc Mathematics',
        fieldOfStudy: 'Mathematics',
        startDate: '2017-09',
        endDate: '2020-06',
      },
    ],
    projects: [
      {
        name: 'Difference Engine CLI',
        description: 'A small CLI.',
        url: 'https://github.com/ada/diff-cli',
      },
    ],
    skills: [{ name: 'TypeScript' }, { name: '  Rust  ' }, { name: '' }],
    links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/ada' }],
    warnings: [],
    ...overrides,
  };
}

function allSelected() {
  return new Set([
    'basics',
    'experience',
    'education',
    'projects',
    'skills',
    'links',
  ] as const);
}

describe('parseImportDate', () => {
  it('parses a bare year', () => {
    expect(parseImportDate('2019')).toEqual({ year: 2019, month: null });
  });

  it('parses YYYY-MM', () => {
    expect(parseImportDate('2019-07')).toEqual({ year: 2019, month: 7 });
  });

  it('parses YYYY-MM-DD to year + month', () => {
    expect(parseImportDate('2019-07-15')).toEqual({ year: 2019, month: 7 });
  });

  it('never fabricates: invalid input yields nulls', () => {
    expect(parseImportDate(null)).toEqual({ year: null, month: null });
    expect(parseImportDate(undefined)).toEqual({ year: null, month: null });
    expect(parseImportDate('garbage')).toEqual({ year: null, month: null });
    expect(parseImportDate('1899')).toEqual({ year: null, month: null });
    expect(parseImportDate('2019-13')).toEqual({ year: 2019, month: null });
  });
});

describe('buildImportPayload', () => {
  it('returns only profile_id when nothing is selected', () => {
    const { payload } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction(),
      selected: new Set(),
    });
    expect(payload).toEqual({ profile_id: VALID_UUID });
  });

  it('maps experiences with integer year/month dates and current flag', () => {
    const { payload, droppedNotes } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction(),
      selected: new Set(['experience']),
    });
    expect(droppedNotes).toEqual([]);
    expect(payload.experience).toEqual([
      {
        role: 'Software Engineer',
        company: 'Analytical Engines Ltd',
        location: 'London',
        start_year: 2021,
        start_month: 3,
        end_year: null,
        end_month: null,
        is_current: true,
        description: 'Built computation pipelines.',
      },
    ]);
  });

  it('skips experience entries without a clear start year and explains why', () => {
    const { payload, droppedNotes } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction({
        experience: [
          { company: 'Mystery Co', role: 'Engineer', startDate: null, isCurrent: false },
        ],
      }),
      selected: new Set(['experience']),
    });
    expect(payload.experience).toEqual([]);
    expect(droppedNotes).toHaveLength(1);
    expect(droppedNotes[0]).toMatch(/start year is unclear/i);
  });

  it('skips experience entries missing role or company', () => {
    const { payload, droppedNotes } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction({
        experience: [{ company: 'Only Company', role: '', startDate: '2020' }],
      }),
      selected: new Set(['experience']),
    });
    expect(payload.experience).toEqual([]);
    expect(droppedNotes.some((n) => /role or company/i.test(n))).toBe(true);
  });

  it('maps education with parsed years', () => {
    const { payload } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction(),
      selected: new Set(['education']),
    });
    expect(payload.education).toEqual([
      {
        institution: 'University of London',
        degree: 'BSc Mathematics',
        field_of_study: 'Mathematics',
        start_year: 2017,
        start_month: 9,
        end_year: 2020,
        end_month: 6,
        description: null,
      },
    ]);
  });

  it('drops education entries without an institution', () => {
    const { payload } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction({
        education: [{ institution: '', degree: 'BSc' }],
      }),
      selected: new Set(['education']),
    });
    expect(payload.education).toEqual([]);
  });

  it('routes GitHub project URLs to repository_url, others to project_url', () => {
    const { payload } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction({
        projects: [
          { name: 'Repo Project', url: 'https://github.com/ada/diff-cli' },
          { name: 'Site Project', url: 'https://ada.dev' },
          { name: 'Unsafe Project', url: 'javascript:alert(1)' },
        ],
      }),
      selected: new Set(['projects']),
    });
    expect(payload.projects).toEqual([
      {
        name: 'Repo Project',
        description: null,
        project_url: 'https://github.com/ada/diff-cli',
        repository_url: 'https://github.com/ada/diff-cli',
      },
      {
        name: 'Site Project',
        description: null,
        project_url: 'https://ada.dev',
        repository_url: null,
      },
      { name: 'Unsafe Project', description: null, project_url: null, repository_url: null },
    ]);
  });

  it('trims skill names and drops empties', () => {
    const { payload } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction(),
      selected: new Set(['skills']),
    });
    expect(payload.skills).toEqual([
      { name: 'TypeScript' },
      { name: 'Rust' },
    ]);
  });

  it('sanitizes link URLs', () => {
    const { payload } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction({
        links: [
          { label: 'LinkedIn', url: 'https://linkedin.com/in/ada' },
          { label: 'Evil', url: 'javascript:alert(1)' },
        ],
      }),
      selected: new Set(['links']),
    });
    expect(payload.links).toEqual([{ label: 'LinkedIn', url: 'https://linkedin.com/in/ada' }]);
  });

  it('includes basics only when the identity has content', () => {
    const { payload: withIdentity } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction(),
      selected: new Set(['basics']),
    });
    expect(withIdentity.basics).toEqual({
      display_name: 'Ada Lovelace',
      headline: 'Engineer',
      location: 'London',
      about: 'Notes on computation.',
    });

    const { payload: withoutIdentity } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction({
        identity: { displayName: null, headline: null, location: null, about: null },
      }),
      selected: new Set(['basics']),
    });
    expect(withoutIdentity.basics).toBeUndefined();
  });

  it('omits sections that were not selected', () => {
    const { payload } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction(),
      selected: new Set(['skills']),
    });
    expect(payload.experience).toBeUndefined();
    expect(payload.education).toBeUndefined();
    expect(payload.projects).toBeUndefined();
    expect(payload.links).toBeUndefined();
    expect(payload.basics).toBeUndefined();
    expect(payload.skills).toHaveLength(2);
  });

  it('builds a complete payload for all selected sections', () => {
    const { payload } = buildImportPayload({
      profileId: VALID_UUID,
      extraction: makeExtraction(),
      selected: allSelected(),
    });
    const typed = payload as ResumeImportPayload;
    expect(typed.profile_id).toBe(VALID_UUID);
    expect(typed.experience).toHaveLength(1);
    expect(typed.education).toHaveLength(1);
    expect(typed.projects).toHaveLength(1);
    expect(typed.skills).toHaveLength(2);
    expect(typed.links).toHaveLength(1);
    expect(typed.basics).toBeDefined();
  });
});

describe('applyResumeImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the RPC summary on success', async () => {
    const summary = {
      inserted: {
        experience: 1,
        education: 1,
        projects: 1,
        skills: 2,
        links: 1,
        basics: 0,
      },
      skipped: {
        experience: 0,
        education: 0,
        projects: 0,
        skills: 0,
        links: 0,
        basics: 0,
      },
      basics_updated: true,
    };
    vi.mocked(getSupabaseClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: summary, error: null }),
    } as never);

    const result = await applyResumeImport({ profile_id: VALID_UUID });
    expect(result).toEqual(summary);
  });

  it('throws when the RPC reports an error', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'profile not found' },
      }),
    } as never);

    await expect(applyResumeImport({ profile_id: VALID_UUID })).rejects.toThrow(
      'profile not found'
    );
  });
});

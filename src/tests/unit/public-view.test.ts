import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicProfileByUsername, PublicPortfolioSchema } from '../../lib/profiles/public';
import realViewRow from '../fixtures/public-view-row.json';

const EMPTY = '[]';
const VIEW_ROW = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  username: 'published-user',
  display_name: 'Published User',
  headline: 'Engineer',
  about: 'Hello world',
  location: null,
  avatar_url: null,
  visibility: 'published',
  // Supabase timestamptz values use numeric offsets; the schema must accept them.
  published_at: '2026-09-23T13:24:14.121+00:00',
  created_at: '2026-09-23T13:24:07.853253+00:00',
  updated_at: '2026-09-23T13:24:30.248715+00:00',
  experiences: JSON.parse(EMPTY),
  education: JSON.parse(EMPTY),
  skills: JSON.parse(EMPTY),
  projects: JSON.parse(EMPTY),
  links: JSON.parse(EMPTY),
  preferences: {
    template_key: 'editorial',
    accent_key: 'rose',
    section_order: ['about', 'experience', 'education', 'projects', 'skills', 'links'],
    hidden_sections: [],
  },
};

describe('anonymous public portfolio lookup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads through the Worker public-profile endpoint, never Supabase from the browser', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(VIEW_ROW), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPublicProfileByUsername('published-user');
    expect(fetchMock).toHaveBeenCalledWith('/api/public/profile/published-user', {
      headers: { Accept: 'application/json' },
    });
    expect(result).not.toBeNull();
    expect(result!.profile.username).toBe('published-user');
    expect(result!.profile).not.toHaveProperty('user_id');
    expect(result!.preferences.template_key).toBe('editorial');
    expect(result!.profile.experiences).toEqual([]);
  });

  it('returns null for non-200 Worker responses without leaking details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    await expect(getPublicProfileByUsername('draft-user')).resolves.toBeNull();
  });

  it('returns null on schema mismatch rather than crashing the page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ...VIEW_ROW, experiences: 'not-an-array' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    await expect(getPublicProfileByUsername('broken-user')).resolves.toBeNull();
  });
});

describe('P0-E: public view contract through the production schema', () => {
  it('validates a REAL anonymous public_profiles payload (fixture captured from the live view)', () => {
    const parsed = PublicPortfolioSchema.safeParse(realViewRow);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.username).toBe('qual-1790169841172');
      expect(parsed.data.evidence).toEqual([]);
      expect(parsed.data.preferences.template_key).toBe('technical');
    }
  });

  it('validates every relation with evidence rows carrying the schema-required id', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const ts = '2026-09-23T13:24:07.853253+00:00';
    const evidenceRow = {
      id: uuid,
      evidence_type: 'commit',
      subject: 'fix: domain authorization',
      summary: 'Ownership now derives from the authenticated principal.',
      source_url: 'https://github.com/o/r/commit/abc',
      source_commit_sha: 'abcdef1234567890abcdef1234567890abcdef12',
      observed_at: ts,
      repository_full_name: 'o/r',
      repository_url: 'https://github.com/o/r',
      repository_language: 'TypeScript',
      repository_topics: ['typescript'],
    };
    const full = {
      ...realViewRow,
      username: 'full-user',
      experiences: [
        {
          id: uuid,
          profile_id: uuid,
          company: 'Acme',
          role: 'Engineer',
          location: null,
          start_year: 2024,
          start_month: 1,
          end_year: null,
          end_month: null,
          is_current: true,
          description: null,
          sort_order: 0,
          created_at: ts,
          updated_at: ts,
        },
      ],
      education: [
        {
          id: uuid,
          profile_id: uuid,
          institution: 'IIT',
          degree: 'B.Tech',
          field_of_study: 'CS',
          start_year: 2020,
          start_month: null,
          end_year: 2024,
          end_month: null,
          description: null,
          sort_order: 0,
          created_at: ts,
          updated_at: ts,
        },
      ],
      skills: [
        {
          id: uuid,
          profile_id: uuid,
          name: 'TypeScript',
          category: null,
          sort_order: 0,
          created_at: ts,
          updated_at: ts,
        },
      ],
      projects: [
        {
          id: uuid,
          profile_id: uuid,
          name: 'career-profile',
          description: null,
          project_url: null,
          repository_url: null,
          sort_order: 0,
          created_at: ts,
          updated_at: ts,
        },
      ],
      links: [
        {
          id: uuid,
          profile_id: uuid,
          label: 'GitHub',
          url: 'https://github.com/u',
          sort_order: 0,
          created_at: ts,
          updated_at: ts,
        },
      ],
      evidence: [evidenceRow],
      achievements: [
        {
          id: uuid,
          title: 'Hackathon winner',
          description: null,
          metric_text: '1st of 120',
          timeframe: '2025',
          source_url: null,
          is_featured: true,
          sort_order: 0,
        },
      ],
    };
    const parsed = PublicPortfolioSchema.safeParse(full);
    expect(parsed.success).toBe(true);
    // Evidence without id must now fail — the P0-E defect shape.
    const noId = { ...evidenceRow } as Record<string, unknown>;
    delete noId.id;
    expect(PublicPortfolioSchema.safeParse({ ...full, evidence: [noId] }).success).toBe(false);
  });

  it('accepts null optionals and empty relations (zero-relation profile)', () => {
    const parsed = PublicPortfolioSchema.safeParse({
      ...realViewRow,
      display_name: null,
      headline: null,
      about: null,
      location: null,
      avatar_url: null,
      published_at: null,
      experiences: [],
      education: [],
      skills: [],
      projects: [],
      links: [],
      evidence: [],
      achievements: [],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid visibility values and missing view columns', () => {
    // Draft exclusion itself is enforced by the SQL view (WHERE
    // visibility = 'published'), not by the DTO enum.
    expect(PublicPortfolioSchema.safeParse({ ...realViewRow, visibility: 'private' }).success).toBe(
      false
    );
    const partial = { ...realViewRow } as Record<string, unknown>;
    delete partial.preferences;
    expect(PublicPortfolioSchema.safeParse(partial).success).toBe(false);
  });
});

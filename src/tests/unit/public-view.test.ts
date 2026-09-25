import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicProfileByUsername } from '../../lib/profiles/public';

const { fromMock, singleMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  singleMock: vi.fn(),
}));

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      fromMock(table);
      return { select: () => ({ eq: () => ({ single: singleMock, maybeSingle: singleMock }) }) };
    },
  }),
}));

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
    vi.clearAllMocks();
  });

  it('reads the anon-safe public_profiles view, never the base table', async () => {
    singleMock.mockResolvedValue({ data: VIEW_ROW, error: null });
    const result = await getPublicProfileByUsername('published-user');
    expect(fromMock).toHaveBeenCalledWith('public_profiles');
    expect(fromMock).not.toHaveBeenCalledWith('profiles');
    expect(result).not.toBeNull();
    expect(result!.profile.username).toBe('published-user');
    // never leaks the account owner
    expect(result!.profile).not.toHaveProperty('user_id');
    expect(result!.preferences.template_key).toBe('editorial');
    expect(result!.profile.experiences).toEqual([]);
  });

  it('returns null when the view has no row instead of leaking errors', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'No rows', code: 'PGRST116' } });
    await expect(getPublicProfileByUsername('draft-user')).resolves.toBeNull();
  });

  it('returns null on schema mismatch rather than crashing the page', async () => {
    singleMock.mockResolvedValue({
      data: { ...VIEW_ROW, experiences: 'not-an-array' },
      error: null,
    });
    await expect(getPublicProfileByUsername('broken-user')).resolves.toBeNull();
  });
});

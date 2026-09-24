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
      return {
        select: () => ({ eq: () => ({ single: singleMock, maybeSingle: singleMock }) }),
      };
    },
  }),
}));

const VIEW_ROW = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  display_name: 'Published User',
  headline: 'Engineer',
  about: 'Hello world',
  location: null,
  avatar_url: null,
  username: 'published-user',
  visibility: 'published',
  // Supabase timestamptz values use numeric offsets; the schema must accept them.
  published_at: '2026-09-23T13:24:14.121+00:00',
  created_at: '2026-09-23T13:24:07.853253+00:00',
  updated_at: '2026-09-23T13:24:30.248715+00:00',
};

describe('anonymous public profile lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the anon-safe public_profiles view, never the base table', async () => {
    singleMock.mockResolvedValue({ data: VIEW_ROW, error: null });
    const profile = await getPublicProfileByUsername('published-user');
    expect(fromMock).toHaveBeenCalledWith('public_profiles');
    expect(fromMock).not.toHaveBeenCalledWith('profiles');
    expect(profile?.username).toBe('published-user');
    expect(profile).not.toHaveProperty('user_id');
  });

  it('returns null when the view has no row instead of leaking errors', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'No rows', code: 'PGRST116' } });
    await expect(getPublicProfileByUsername('draft-user')).resolves.toBeNull();
  });
});

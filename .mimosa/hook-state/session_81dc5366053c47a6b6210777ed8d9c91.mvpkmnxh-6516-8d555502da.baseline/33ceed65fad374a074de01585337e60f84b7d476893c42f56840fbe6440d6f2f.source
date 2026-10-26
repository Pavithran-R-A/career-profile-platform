import { describe, it, expect, vi, beforeEach } from 'vitest';

// The repository module reads the shared supabase client; inject a fake.
const fakeClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => fakeClient,
}));

import { ProfileRepository, ProfileAppError } from '../../lib/profiles/repository';
import { safeProfileErrorMessage } from '../../lib/profiles/service';

/** Builder mirroring the supabase-js query-builder shape the repo uses. */
function query<T>(result: { data: T | null; error: { message: string; code?: string } | null }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (v: { data: T | null; error: unknown }) => void) =>
      resolve({ data: result.data, error: result.error }),
  };
  return builder;
}

const PROFILE_ROW = {
  id: 'profile-1',
  user_id: 'user-1',
  username: 'ada',
  display_name: 'Ada',
  headline: null,
  about: null,
  location: null,
  avatar_url: null,
  visibility: 'draft',
  published_at: null,
  created_at: '',
  updated_at: '',
};

describe('getProfileByUserId error semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null ONLY when the profile genuinely does not exist', async () => {
    fakeClient.from.mockReturnValue(query({ data: null, error: null }));
    const repo = new ProfileRepository();
    await expect(repo.getProfileByUserId('user-1')).resolves.toBeNull();
  });

  it('THROWS a customer-safe error when the profile query fails (backend outage ≠ missing profile)', async () => {
    fakeClient.from.mockReturnValue(
      query({ data: null, error: { message: 'relation "profiles" does not exist', code: '42P01' } })
    );
    const repo = new ProfileRepository();
    const err = await repo.getProfileByUserId('user-1').catch((e) => e);
    expect(err).toBeInstanceOf(ProfileAppError);
    expect(err.reason).toBe('backend');
    // Raw Postgres text must NOT surface.
    expect(err.message).not.toContain('42P01');
    expect(err.message).not.toContain('relation');
  });

  it('THROWS on a network-ish failure', async () => {
    fakeClient.from.mockReturnValue(
      query({ data: null, error: { message: 'TypeError: Failed to fetch', code: 'NETWORK' } })
    );
    const repo = new ProfileRepository();
    const err = await repo.getProfileByUserId('user-1').catch((e) => e);
    expect(err).toBeInstanceOf(ProfileAppError);
    expect(err.reason).toBe('network');
  });

  it('does NOT turn a failed relation query into an empty array (experience)', async () => {
    const okQuery = query({ data: [], error: null });
    const failingExperience = query({
      data: null,
      error: { message: 'connection terminated unexpectedly', code: '57P01' },
    });
    fakeClient.from.mockImplementation((table: string) =>
      table === 'profiles'
        ? query({ data: PROFILE_ROW, error: null })
        : table === 'profile_experiences'
          ? failingExperience
          : okQuery
    );
    const repo = new ProfileRepository();
    const err = await repo.getProfileByUserId('user-1').catch((e) => e);
    expect(err).toBeInstanceOf(ProfileAppError);
    expect(err.message).not.toContain('57P01');
  });

  it('does NOT turn a failed skills query into an empty array', async () => {
    const okQuery = query({ data: [], error: null });
    const failingSkills = query({
      data: null,
      error: { message: 'server closed the connection', code: '08006' },
    });
    fakeClient.from.mockImplementation((table: string) =>
      table === 'profiles'
        ? query({ data: PROFILE_ROW, error: null })
        : table === 'profile_skills'
          ? failingSkills
          : okQuery
    );
    const repo = new ProfileRepository();
    await expect(repo.getProfileByUserId('user-1')).rejects.toBeInstanceOf(ProfileAppError);
  });

  it('loads a fully populated profile when every query succeeds', async () => {
    fakeClient.from.mockImplementation((table: string) =>
      table === 'profiles'
        ? query({ data: PROFILE_ROW, error: null })
        : query({ data: [], error: null })
    );
    const repo = new ProfileRepository();
    const profile = await repo.getProfileByUserId('user-1');
    expect(profile).not.toBeNull();
    expect(profile!.username).toBe('ada');
  });
});

describe('createProfileWithBasics (atomic onboarding)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs ONE RPC call (create + basics in a single statement)', async () => {
    fakeClient.rpc.mockResolvedValue({ data: 'profile-1', error: null });
    const repo = new ProfileRepository();
    const id = await repo.createProfileWithBasics({
      userId: 'user-1',
      username: 'ada',
      displayName: 'Ada',
      headline: 'Eng',
      about: 'bio',
      location: 'Pune',
    });
    expect(id).toBe('profile-1');
    expect(fakeClient.rpc).toHaveBeenCalledTimes(1);
    expect(fakeClient.rpc).toHaveBeenCalledWith('create_profile_with_basics', {
      p_user_id: 'user-1',
      p_username: 'ada',
      p_display_name: 'Ada',
      p_headline: 'Eng',
      p_about: 'bio',
      p_location: 'Pune',
    });
  });

  it('propagates null when the username is taken (no duplicate insert possible)', async () => {
    fakeClient.rpc.mockResolvedValue({ data: null, error: null });
    const repo = new ProfileRepository();
    const id = await repo.createProfileWithBasics({
      userId: 'user-2',
      username: 'ada',
      displayName: '',
      headline: '',
      about: '',
      location: '',
    });
    expect(id).toBeNull();
  });

  it('treats the unique-index collision as a taken username under owner RLS', async () => {
    fakeClient.rpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const repo = new ProfileRepository();
    const result = await repo.createProfileWithBasics({
      userId: 'user-2',
      username: 'taken',
      displayName: 'Example',
      headline: '',
      about: '',
      location: '',
    });
    expect(result).toBeNull();
  });

  it('throws customer-safe on RPC failure', async () => {
    fakeClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "profiles_username_key"' },
    });
    const repo = new ProfileRepository();
    const err = await repo
      .createProfileWithBasics({
        userId: 'user-1',
        username: 'ada',
        displayName: '',
        headline: '',
        about: '',
        location: '',
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ProfileAppError);
    expect(err.message).not.toContain('duplicate key');
  });
});

describe('safeProfileErrorMessage (customer-safe mapper)', () => {
  it('maps network failures', () => {
    expect(safeProfileErrorMessage(new Error('TypeError: Failed to fetch'))).toContain(
      'Could not reach the server'
    );
  });

  it('hides raw database error text', () => {
    const raw = 'pg error: column "xyz" of relation "profiles" does not exist';
    expect(safeProfileErrorMessage(new Error(raw))).toBe('Something went wrong. Please try again.');
  });

  it('keeps ProfileAppError messages (already customer-safe)', () => {
    const err = new ProfileAppError(
      'backend',
      'Something went wrong loading your profile. Please try again.'
    );
    expect(safeProfileErrorMessage(err)).toBe(err.message);
  });

  it('handles non-Error throwables', () => {
    expect(safeProfileErrorMessage('weird')).toBe('Something went wrong. Please try again.');
  });
});

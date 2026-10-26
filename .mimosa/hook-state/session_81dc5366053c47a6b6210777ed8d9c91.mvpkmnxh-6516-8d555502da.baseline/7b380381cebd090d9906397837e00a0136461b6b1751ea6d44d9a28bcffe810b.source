import { getSupabaseClient } from '../supabase/client';

export interface ProfileWithRelations {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  avatar_url: string | null;
  visibility: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  experiences: ExperienceRow[];
  education: EducationRow[];
  projects: ProjectRow[];
  skills: SkillRow[];
  links: LinkRow[];
}

export interface AchievementRow {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  metric_text: string | null;
  timeframe: string | null;
  source_url: string | null;
  is_featured: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ExperienceRow {
  id: string;
  profile_id: string;
  company: string;
  role: string;
  location: string | null;
  start_year: number;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EducationRow {
  id: string;
  profile_id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  project_url: string | null;
  repository_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SkillRow {
  id: string;
  profile_id: string;
  name: string;
  category: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LinkRow {
  id: string;
  profile_id: string;
  label: string;
  url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface RawProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  avatar_url: string | null;
  visibility: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Customer-safe application error. The message is ALWAYS safe to show; raw
 * Postgres/Supabase error text never reaches the UI.
 */
export class ProfileAppError extends Error {
  readonly reason: 'network' | 'backend';
  constructor(reason: 'network' | 'backend', message: string) {
    super(message);
    this.name = 'ProfileAppError';
    this.reason = reason;
  }
}

function isNetworkish(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === 'NETWORK' ||
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  );
}

function throwProfileLoadError(source: string, error: { message?: string; code?: string }): never {
  if (isNetworkish(error)) {
    console.error(JSON.stringify({ t: 'profile_load_network_error', source }));
    throw new ProfileAppError(
      'network',
      'Could not reach the server. Check your connection and try again.'
    );
  }
  // NEVER surface raw Postgres error text.
  console.error(
    JSON.stringify({ t: 'profile_load_error', source, code: error?.code ?? 'unknown' })
  );
  throw new ProfileAppError(
    'backend',
    'Something went wrong loading your profile. Please try again.'
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function castArray<T>(data: any): T[] {
  return (data || []) as T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function castOne<T>(data: any): T {
  return data as T;
}

export class ProfileRepository {
  /**
   * null means "the user genuinely has no profile". Backend or network
   * failures THROW a customer-safe ProfileAppError — a query outage must
   * never masquerade as an empty/missing profile.
   */
  async getProfileByUserId(userId: string): Promise<ProfileWithRelations | null> {
    const supabase = getSupabaseClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      throwProfileLoadError('getProfileByUserId', profileError);
    }
    if (!profile) {
      return null;
    }

    const profileId = castOne<RawProfile>(profile).id;

    // EVERY relation result's error is checked — a failed query must not
    // silently become an empty array (a populated profile would render empty).
    const [experiencesResult, educationResult, projectsResult, skillsResult, linksResult] =
      await Promise.all([
        supabase
          .from('profile_experiences')
          .select('*')
          .eq('profile_id', profileId)
          .order('sort_order'),
        supabase
          .from('profile_education')
          .select('*')
          .eq('profile_id', profileId)
          .order('sort_order'),
        supabase
          .from('profile_projects')
          .select('*')
          .eq('profile_id', profileId)
          .order('sort_order'),
        supabase.from('profile_skills').select('*').eq('profile_id', profileId).order('sort_order'),
        supabase.from('profile_links').select('*').eq('profile_id', profileId).order('sort_order'),
      ]);

    if (experiencesResult.error) throwProfileLoadError('experiences', experiencesResult.error);
    if (educationResult.error) throwProfileLoadError('education', educationResult.error);
    if (projectsResult.error) throwProfileLoadError('projects', projectsResult.error);
    if (skillsResult.error) throwProfileLoadError('skills', skillsResult.error);
    if (linksResult.error) throwProfileLoadError('links', linksResult.error);

    return {
      ...castOne<RawProfile>(profile),
      experiences: castArray<ExperienceRow>(experiencesResult.data),
      education: castArray<EducationRow>(educationResult.data),
      projects: castArray<ProjectRow>(projectsResult.data),
      skills: castArray<SkillRow>(skillsResult.data),
      links: castArray<LinkRow>(linksResult.data),
    };
  }

  /**
   * ATOMIC onboarding insert: user_id, username, display_name, headline,
   * about, location in ONE statement (RPC). Resume semantics: if the user
   * already owns a profile (a previous partial attempt), it is updated, not
   * duplicated. Returns the profile id, or null when the username is taken.
   */
  async createProfileWithBasics(input: {
    userId: string;
    username: string;
    displayName: string;
    headline: string;
    about: string;
    location: string;
  }): Promise<string | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc(
      'create_profile_with_basics' as never,
      {
        p_user_id: input.userId,
        p_username: input.username,
        p_display_name: input.displayName,
        p_headline: input.headline,
        p_about: input.about,
        p_location: input.location,
      } as never
    );

    if (error) {
      // An authenticated caller can only SELECT their own rows under RLS.
      // A different user's username is therefore invisible to the optional
      // availability probe, but the database's unique index still protects
      // the INSERT. Treat that race/collision as "username taken", not a
      // generic backend outage.
      if (error.code === '23505') return null;
      throwProfileLoadError('createProfileWithBasics', error);
    }
    return (data as unknown as string | null) ?? null;
  }

  async updateProfile(
    profileId: string,
    updates: Record<string, unknown>
  ): Promise<ProfileWithRelations> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('profiles')
      .update(updates as never)
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      throwProfileLoadError('updateProfile', error);
    }

    return castOne<ProfileWithRelations>(data);
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .ilike('username', username);

    if (error) {
      throwProfileLoadError('checkUsernameAvailability', error);
    }

    return count === 0;
  }
}

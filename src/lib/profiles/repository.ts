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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function castArray<T>(data: any): T[] {
  return (data || []) as T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function castOne<T>(data: any): T {
  return data as T;
}

export class ProfileRepository {
  async getProfileByUserId(userId: string): Promise<ProfileWithRelations | null> {
    const supabase = getSupabaseClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return null;
    }

    const profileId = castOne<RawProfile>(profile).id;

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

    return {
      ...castOne<RawProfile>(profile),
      experiences: castArray<ExperienceRow>(experiencesResult.data),
      education: castArray<EducationRow>(educationResult.data),
      projects: castArray<ProjectRow>(projectsResult.data),
      skills: castArray<SkillRow>(skillsResult.data),
      links: castArray<LinkRow>(linksResult.data),
    };
  }

  async createProfile(userId: string, username: string): Promise<ProfileWithRelations> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('profiles')
      .insert({ user_id: userId, username } as never)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      ...castOne<RawProfile>(data),
      experiences: [],
      education: [],
      projects: [],
      skills: [],
      links: [],
    };
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
      throw new Error(error.message);
    }

    return castOne<ProfileWithRelations>(data);
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .ilike('username', username);

    return count === 0;
  }
}

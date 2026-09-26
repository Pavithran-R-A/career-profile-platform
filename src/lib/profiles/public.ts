import { z } from 'zod';
import { getSupabaseClient } from '../supabase/client';
import type { PortfolioProfile } from '../templates/types';

const ts = z.string().datetime({ offset: true });
const uuid = z.string().uuid();

const ExperienceSchema = z.object({
  id: uuid,
  profile_id: uuid,
  company: z.string(),
  role: z.string(),
  location: z.string().nullable(),
  start_year: z.number(),
  start_month: z.number().nullable(),
  end_year: z.number().nullable(),
  end_month: z.number().nullable(),
  is_current: z.boolean(),
  description: z.string().nullable(),
  sort_order: z.number(),
  created_at: ts,
  updated_at: ts,
});

const EducationSchema = z.object({
  id: uuid,
  profile_id: uuid,
  institution: z.string(),
  degree: z.string().nullable(),
  field_of_study: z.string().nullable(),
  start_year: z.number().nullable(),
  start_month: z.number().nullable(),
  end_year: z.number().nullable(),
  end_month: z.number().nullable(),
  description: z.string().nullable(),
  sort_order: z.number(),
  created_at: ts,
  updated_at: ts,
});

const SkillSchema = z.object({
  id: uuid,
  profile_id: uuid,
  name: z.string(),
  category: z.string().nullable(),
  sort_order: z.number(),
  created_at: ts,
  updated_at: ts,
});

const ProjectSchema = z.object({
  id: uuid,
  profile_id: uuid,
  name: z.string(),
  description: z.string().nullable(),
  project_url: z.string().nullable(),
  repository_url: z.string().nullable(),
  sort_order: z.number(),
  created_at: ts,
  updated_at: ts,
});

const LinkSchema = z.object({
  id: uuid,
  profile_id: uuid,
  label: z.string(),
  url: z.string(),
  sort_order: z.number(),
  created_at: ts,
  updated_at: ts,
});

export const PublicPreferencesSchema = z.object({
  template_key: z.string(),
  accent_key: z.string(),
  section_order: z.array(z.string()),
  hidden_sections: z.array(z.string()),
});

export type PublicPreferences = z.infer<typeof PublicPreferencesSchema>;

/**
 * Public-safe portfolio shape served by the anon-granted `public_profiles`
 * view: basics + presentation relations + saved preferences. Never contains
 * `user_id` or any other internal column. Drafts are excluded by the view.
 */
const PublicPortfolioSchema = z.object({
  id: uuid,
  username: z.string(),
  display_name: z.string().nullable(),
  headline: z.string().nullable(),
  about: z.string().nullable(),
  location: z.string().nullable(),
  avatar_url: z.string().nullable(),
  visibility: z.enum(['draft', 'published']),
  published_at: ts.nullable(),
  created_at: ts,
  updated_at: ts,
  experiences: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.array(SkillSchema),
  projects: z.array(ProjectSchema),
  links: z.array(LinkSchema),
  preferences: PublicPreferencesSchema,
});

export type PublicPortfolio = z.infer<typeof PublicPortfolioSchema>;

export interface PublicPortfolioResult {
  profile: PortfolioProfile;
  preferences: PublicPreferences;
}

function toPortfolio(row: PublicPortfolio): PublicPortfolioResult {
  const { experiences, education, skills, projects, links, preferences, ...basics } = row;
  return {
    profile: { ...basics, experiences, education, skills, projects, links },
    preferences,
  };
}

/**
 * Anonymous-safe portfolio lookup: reads the `public_profiles` view
 * (granted to anon, published-only, no user_id) and maps it into the
 * template-facing profile shape.
 */
export async function getPublicProfileByUsername(
  username: string
): Promise<PublicPortfolioResult | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error || !data) return null;

  const parsed = PublicPortfolioSchema.safeParse(data);
  if (!parsed.success) return null;

  return toPortfolio(parsed.data);
}

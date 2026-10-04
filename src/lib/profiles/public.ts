import { z } from 'zod';
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

const EvidenceSchema = z.object({
  id: uuid,
  evidence_type: z.string(),
  subject: z.string(),
  summary: z.string(),
  source_url: z.string().nullable(),
  source_commit_sha: z.string().nullable(),
  observed_at: ts,
  repository_full_name: z.string().nullable(),
  repository_url: z.string().nullable(),
  repository_language: z.string().nullable(),
  repository_topics: z.array(z.string()).nullable(),
});

/** Owner-curated, opt-in public achievement (public-safe columns only). */
const AchievementSchema = z.object({
  id: uuid,
  title: z.string(),
  description: z.string().nullable(),
  metric_text: z.string().nullable(),
  timeframe: z.string().nullable(),
  source_url: z.string().nullable(),
  is_featured: z.boolean(),
  sort_order: z.number(),
});

export const PublicPreferencesSchema = z.object({
  template_key: z.string(),
  accent_key: z.string(),
  section_order: z.array(z.string()),
  hidden_sections: z.array(z.string()),
});

export type PublicPreferences = z.infer<typeof PublicPreferencesSchema>;

/**
 * Public-safe portfolio shape returned by the Worker public-profile endpoint.
 * The Worker reads a server-only projection; browser code never receives a
 * privileged Supabase credential or direct access to the source view.
 */
export const PublicPortfolioSchema = z.object({
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
  evidence: z.array(EvidenceSchema).default([]),
  achievements: z.array(AchievementSchema).default([]),
  preferences: PublicPreferencesSchema,
});

export type PublicPortfolio = z.infer<typeof PublicPortfolioSchema>;

export interface PublicPortfolioResult {
  profile: PortfolioProfile;
  preferences: PublicPreferences;
}

function toPortfolio(row: PublicPortfolio): PublicPortfolioResult {
  const { experiences, education, skills, projects, links, preferences, achievements, ...basics } =
    row;
  return {
    profile: { ...basics, experiences, education, skills, projects, links, achievements },
    preferences,
  };
}

/**
 * Anonymous-safe portfolio lookup through the same-origin Worker API.
 * Database projection views remain server-only.
 */
export async function getPublicProfileByUsername(
  username: string
): Promise<PublicPortfolioResult | null> {
  try {
    const response = await fetch(`/api/public/profile/${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const data: unknown = await response.json();
    const parsed = PublicPortfolioSchema.safeParse(data);
    if (!parsed.success) return null;

    return toPortfolio(parsed.data);
  } catch {
    return null;
  }
}

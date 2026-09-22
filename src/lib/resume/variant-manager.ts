import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import type { ProfileWithRelations } from '../profiles/repository';
import type { ParsedJob } from './job-parser';
import type { MatchingResult } from './requirement-matcher';

export const VariantStatus = {
  draft: 'draft',
  active: 'active',
  archived: 'archived',
} as const;

export type VariantStatus = (typeof VariantStatus)[keyof typeof VariantStatus];

export interface ProfileVariant {
  id: string;
  profileId: string;
  jobId: string;
  jobTitle: string;
  company: string | null;
  status: VariantStatus;
  matchScore: number;
  customizations: VariantCustomizations;
  createdAt: string;
  updatedAt: string;
}

export interface VariantCustomizations {
  headline?: string;
  about?: string;
  skills?: string[];
  experienceHighlights?: string[];
  projectHighlights?: string[];
  hiddenSections?: string[];
  sectionOrder?: string[];
}

export interface CreateVariantInput {
  profileId: string;
  job: ParsedJob;
  matchingResult: MatchingResult;
  customizations?: VariantCustomizations;
}

export interface UpdateVariantInput {
  status?: VariantStatus;
  customizations?: Partial<VariantCustomizations>;
}

export interface VariantWithProfile extends ProfileVariant {
  profile: ProfileWithRelations;
}

export class VariantManager {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseUrl: string, publishableKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, publishableKey);
  }

  async createVariant(input: CreateVariantInput): Promise<ProfileVariant> {
    const { profileId, job, matchingResult, customizations = {} } = input;

    const jobId = crypto.randomUUID();
    const variantData = {
      profile_id: profileId,
      job_id: jobId,
      job_title: job.title,
      company: job.company,
      status: 'draft' as const,
      match_score: matchingResult.overallScore,
      customizations: this.buildDefaultCustomizations(
        job,
        matchingResult,
        customizations
      ) as unknown as Record<string, unknown>,
    };

    const { data, error } = await this.supabase
      .from('profile_variants' as never)
      .insert(variantData as never)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create variant: ${error.message}`);
    }

    return this.mapRowToVariant(data);
  }

  async getVariant(variantId: string): Promise<ProfileVariant | null> {
    const { data, error } = await this.supabase
      .from('profile_variants')
      .select('*')
      .eq('id', variantId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapRowToVariant(data);
  }

  async getVariantsByProfile(profileId: string): Promise<ProfileVariant[]> {
    const { data, error } = await this.supabase
      .from('profile_variants' as never)
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch variants: ${error.message}`);
    }

    return ((data as unknown as Record<string, unknown>[]) || []).map((row) =>
      this.mapRowToVariant(row)
    );
  }

  async getActiveVariant(profileId: string): Promise<ProfileVariant | null> {
    const { data, error } = await this.supabase
      .from('profile_variants' as never)
      .select('*')
      .eq('profile_id', profileId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapRowToVariant(data as unknown as Record<string, unknown>);
  }

  async updateVariant(variantId: string, input: UpdateVariantInput): Promise<ProfileVariant> {
    const updateData: Record<string, unknown> = {};

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    if (input.customizations !== undefined) {
      const existing = await this.getVariant(variantId);
      if (!existing) {
        throw new Error('Variant not found');
      }
      updateData.customizations = {
        ...existing.customizations,
        ...input.customizations,
      };
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('profile_variants' as never)
      .update(updateData as never)
      .eq('id', variantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update variant: ${error.message}`);
    }

    return this.mapRowToVariant(data as unknown as Record<string, unknown>);
  }

  async activateVariant(variantId: string): Promise<ProfileVariant> {
    const variant = await this.getVariant(variantId);
    if (!variant) {
      throw new Error('Variant not found');
    }

    const { error: deactivateError } = await this.supabase
      .from('profile_variants')
      .update({ status: 'archived' })
      .eq('profile_id', variant.profileId)
      .eq('status', 'active');

    if (deactivateError) {
      throw new Error(`Failed to deactivate existing variants: ${deactivateError.message}`);
    }

    return this.updateVariant(variantId, { status: 'active' });
  }

  async deleteVariant(variantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('profile_variants' as never)
      .delete()
      .eq('id', variantId);

    if (error) {
      throw new Error(`Failed to delete variant: ${error.message}`);
    }
  }

  async archiveAllVariants(profileId: string): Promise<void> {
    const { error } = await this.supabase
      .from('profile_variants' as never)
      .update({ status: 'archived' } as never)
      .eq('profile_id', profileId)
      .neq('status', 'archived');

    if (error) {
      throw new Error(`Failed to archive variants: ${error.message}`);
    }
  }

  async getVariantWithProfile(variantId: string): Promise<VariantWithProfile | null> {
    const variant = await this.getVariant(variantId);
    if (!variant) {
      return null;
    }

    const { data: profileData, error: profileError } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', variant.profileId)
      .single();

    if (profileError || !profileData) {
      return null;
    }

    const profileId = (profileData as { id: string }).id;

    const [experiencesResult, educationResult, projectsResult, skillsResult, linksResult] =
      await Promise.all([
        this.supabase
          .from('profile_experiences')
          .select('*')
          .eq('profile_id', profileId)
          .order('sort_order'),
        this.supabase
          .from('profile_education')
          .select('*')
          .eq('profile_id', profileId)
          .order('sort_order'),
        this.supabase
          .from('profile_projects')
          .select('*')
          .eq('profile_id', profileId)
          .order('sort_order'),
        this.supabase
          .from('profile_skills')
          .select('*')
          .eq('profile_id', profileId)
          .order('sort_order'),
        this.supabase
          .from('profile_links')
          .select('*')
          .eq('profile_id', profileId)
          .order('sort_order'),
      ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const castArray = <T>(data: any): T[] => (data || []) as T[];

    const profile: ProfileWithRelations = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(profileData as any),
      experiences: castArray(experiencesResult.data),
      education: castArray(educationResult.data),
      projects: castArray(projectsResult.data),
      skills: castArray(skillsResult.data),
      links: castArray(linksResult.data),
    };

    return { ...variant, profile };
  }

  private buildDefaultCustomizations(
    _job: ParsedJob,
    matchingResult: MatchingResult,
    overrides: VariantCustomizations
  ): VariantCustomizations {
    const highlightedSkills = matchingResult.matches
      .filter((m) => m.strength === 'exact' || m.strength === 'strong' || m.strength === 'moderate')
      .map((m) => m.requirement.text)
      .slice(0, 10);

    const hiddenSections: string[] = [];
    if (matchingResult.summary.byCategory.education.matched === 0) {
      hiddenSections.push('education');
    }

    return {
      headline: overrides.headline,
      about: overrides.about,
      skills: overrides.skills || highlightedSkills,
      experienceHighlights: overrides.experienceHighlights || [],
      projectHighlights: overrides.projectHighlights || [],
      hiddenSections: overrides.hiddenSections || hiddenSections,
      sectionOrder: overrides.sectionOrder,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRowToVariant(row: any): ProfileVariant {
    return {
      id: row.id,
      profileId: row.profile_id,
      jobId: row.job_id,
      jobTitle: row.job_title,
      company: row.company,
      status: row.status,
      matchScore: row.match_score,
      customizations: row.customizations || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

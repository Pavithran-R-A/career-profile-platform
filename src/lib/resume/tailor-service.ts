import type { ProfileWithRelations } from '../profiles/repository';
import type { ParsedJob } from './job-parser';
import type { MatchingResult } from './requirement-matcher';
import type { ProfileVariant, VariantCustomizations } from './variant-manager';
import { VariantManager } from './variant-manager';
import { matchRequirements } from './requirement-matcher';
import { parseJobDescription } from './job-parser';

export const TailorStatus = {
  idle: 'idle',
  parsing: 'parsing',
  matching: 'matching',
  generating: 'generating',
  applying: 'applying',
  completed: 'completed',
  error: 'error',
} as const;

export type TailorStatus = (typeof TailorStatus)[keyof typeof TailorStatus];

export interface TailorJobInput {
  profileId: string;
  jobDescription: string;
  customizations?: VariantCustomizations;
}

export interface TailorResult {
  variant: ProfileVariant;
  matchingResult: MatchingResult;
  tailoredProfile: TailoredProfile;
}

export interface TailoredProfile {
  headline: string;
  about: string;
  skills: string[];
  experienceOrder: string[];
  projectOrder: string[];
  sectionVisibility: Record<string, boolean>;
}

export interface TailorProgress {
  status: TailorStatus;
  message: string;
  percent: number;
}

type TailorProgressCallback = (progress: TailorProgress) => void;

export class TailorService {
  private variantManager: VariantManager;

  constructor(supabaseUrl: string, publishableKey: string) {
    this.variantManager = new VariantManager(supabaseUrl, publishableKey);
  }

  async tailorProfile(
    input: TailorJobInput,
    profile: ProfileWithRelations,
    onProgress?: TailorProgressCallback
  ): Promise<TailorResult> {
    const { profileId, jobDescription, customizations } = input;

    this.reportProgress(onProgress, TailorStatus.parsing, 'Parsing job description...', 10);

    const parsedJob = parseJobDescription(jobDescription);

    this.reportProgress(onProgress, TailorStatus.matching, 'Matching requirements...', 30);

    const matchingResult = matchRequirements(parsedJob, profile);

    this.reportProgress(onProgress, TailorStatus.generating, 'Generating tailored profile...', 50);

    const tailoredProfile = this.generateTailoredProfile(
      profile,
      parsedJob,
      matchingResult,
      customizations
    );

    this.reportProgress(onProgress, TailorStatus.applying, 'Creating variant...', 80);

    const variant = await this.variantManager.createVariant({
      profileId,
      job: parsedJob,
      matchingResult,
      customizations,
    });

    this.reportProgress(onProgress, TailorStatus.completed, 'Tailoring complete!', 100);

    return {
      variant,
      matchingResult,
      tailoredProfile,
    };
  }

  async updateTailoring(
    variantId: string,
    profile: ProfileWithRelations,
    customizations: Partial<VariantCustomizations>
  ): Promise<TailoredProfile> {
    const variant = await this.variantManager.getVariant(variantId);
    if (!variant) {
      throw new Error('Variant not found');
    }

    const updatedVariant = await this.variantManager.updateVariant(variantId, {
      customizations,
    });

    const mockJob: ParsedJob = {
      title: updatedVariant.jobTitle,
      company: updatedVariant.company,
      location: null,
      remote: null,
      salaryRange: null,
      summary: null,
      requirements: [],
      rawText: '',
      parsedAt: new Date().toISOString(),
    };

    const mockMatching: MatchingResult = {
      overallScore: updatedVariant.matchScore,
      matches: [],
      gaps: [],
      summary: {
        totalRequirements: 0,
        matched: 0,
        partialMatched: 0,
        unmatched: 0,
        byCategory: {} as Record<string, { matched: number; total: number }>,
      },
    };

    return this.generateTailoredProfile(
      profile,
      mockJob,
      mockMatching,
      updatedVariant.customizations
    );
  }

  async activateVariant(variantId: string): Promise<ProfileVariant> {
    return this.variantManager.activateVariant(variantId);
  }

  async getVariant(variantId: string): Promise<ProfileVariant | null> {
    return this.variantManager.getVariant(variantId);
  }

  async getVariantsByProfile(profileId: string): Promise<ProfileVariant[]> {
    return this.variantManager.getVariantsByProfile(profileId);
  }

  async deleteVariant(variantId: string): Promise<void> {
    return this.variantManager.deleteVariant(variantId);
  }

  private generateTailoredProfile(
    profile: ProfileWithRelations,
    job: ParsedJob,
    matchingResult: MatchingResult,
    customizations?: VariantCustomizations
  ): TailoredProfile {
    const headline = customizations?.headline || this.generateHeadline(profile, job);
    const about = customizations?.about || this.generateAbout(profile, job, matchingResult);
    const skills = customizations?.skills || this.generateSkills(profile, matchingResult);

    const experienceOrder = this.orderExperience(
      profile,
      matchingResult,
      customizations?.experienceHighlights
    );
    const projectOrder = this.orderProjects(
      profile,
      matchingResult,
      customizations?.projectHighlights
    );

    const sectionVisibility = this.calculateSectionVisibility(
      profile,
      matchingResult,
      customizations?.hiddenSections
    );

    return {
      headline,
      about,
      skills,
      experienceOrder,
      projectOrder,
      sectionVisibility,
    };
  }

  private generateHeadline(profile: ProfileWithRelations, job: ParsedJob): string {
    const baseHeadline = profile.headline || profile.display_name || '';
    if (!baseHeadline) {
      return job.title;
    }
    return baseHeadline;
  }

  private generateAbout(
    profile: ProfileWithRelations,
    _job: ParsedJob,
    matchingResult: MatchingResult
  ): string {
    const baseAbout = profile.about || '';
    if (!baseAbout) {
      return '';
    }

    const matchedSkills = matchingResult.matches
      .filter((m) => m.strength === 'exact' || m.strength === 'strong')
      .map((m) => m.requirement.text)
      .slice(0, 5);

    if (matchedSkills.length === 0) {
      return baseAbout;
    }

    const skillHighlight = ` Proficient in ${matchedSkills.join(', ')}.`;
    return baseAbout + skillHighlight;
  }

  private generateSkills(profile: ProfileWithRelations, matchingResult: MatchingResult): string[] {
    const matchedSkills = matchingResult.matches
      .filter((m) => m.strength === 'exact' || m.strength === 'strong' || m.strength === 'moderate')
      .flatMap((m) => m.matchedEvidence)
      .filter((skill): skill is string => typeof skill === 'string' && skill.length > 0);

    const allProfileSkills = profile.skills.map((s) => s.name);
    const uniqueMatched = [...new Set(matchedSkills)];
    const remaining = allProfileSkills.filter((s) => !uniqueMatched.includes(s));

    return [...uniqueMatched, ...remaining];
  }

  private orderExperience(
    profile: ProfileWithRelations,
    matchingResult: MatchingResult,
    highlights?: string[]
  ): string[] {
    const experienceScores = new Map<string, number>();

    for (const exp of profile.experiences) {
      let score = 0;

      for (const match of matchingResult.matches) {
        const expText = `${exp.role} ${exp.company} ${exp.description || ''}`.toLowerCase();
        if (match.matchedEvidence.some((e) => expText.includes(e.toLowerCase()))) {
          score += match.strength === 'exact' ? 3 : match.strength === 'strong' ? 2 : 1;
        }
      }

      if (highlights?.some((h) => exp.role.toLowerCase().includes(h.toLowerCase()))) {
        score += 10;
      }

      experienceScores.set(exp.id, score);
    }

    return profile.experiences
      .sort((a, b) => (experienceScores.get(b.id) || 0) - (experienceScores.get(a.id) || 0))
      .map((exp) => exp.id);
  }

  private orderProjects(
    profile: ProfileWithRelations,
    matchingResult: MatchingResult,
    highlights?: string[]
  ): string[] {
    const projectScores = new Map<string, number>();

    for (const proj of profile.projects) {
      let score = 0;

      for (const match of matchingResult.matches) {
        const projText = `${proj.name} ${proj.description || ''}`.toLowerCase();
        if (match.matchedEvidence.some((e) => projText.includes(e.toLowerCase()))) {
          score += match.strength === 'exact' ? 3 : match.strength === 'strong' ? 2 : 1;
        }
      }

      if (highlights?.some((h) => proj.name.toLowerCase().includes(h.toLowerCase()))) {
        score += 10;
      }

      projectScores.set(proj.id, score);
    }

    return profile.projects
      .sort((a, b) => (projectScores.get(b.id) || 0) - (projectScores.get(a.id) || 0))
      .map((proj) => proj.id);
  }

  private calculateSectionVisibility(
    profile: ProfileWithRelations,
    matchingResult: MatchingResult,
    hiddenSections?: string[]
  ): Record<string, boolean> {
    const visibility: Record<string, boolean> = {
      identity: true,
      about: true,
      experience: true,
      education: true,
      projects: true,
      skills: true,
      links: true,
    };

    if (hiddenSections) {
      for (const section of hiddenSections) {
        visibility[section] = false;
      }
    }

    if (profile.experiences.length === 0 && !hiddenSections?.includes('experience')) {
      visibility.experience = false;
    }

    if (profile.projects.length === 0 && !hiddenSections?.includes('projects')) {
      visibility.projects = false;
    }

    if (profile.education.length === 0 && !hiddenSections?.includes('education')) {
      visibility.education = false;
    }

    if (matchingResult.summary.totalRequirements === 0) {
      return visibility;
    }

    const skillMatchRatio =
      matchingResult.summary.byCategory.skill?.matched /
      (matchingResult.summary.byCategory.skill?.total || 1);

    if (skillMatchRatio < 0.3) {
      visibility.skills = true;
    }

    return visibility;
  }

  private reportProgress(
    callback: TailorProgressCallback | undefined,
    status: TailorStatus,
    message: string,
    percent: number
  ): void {
    if (callback) {
      callback({ status, message, percent });
    }
  }
}

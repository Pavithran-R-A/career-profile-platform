import type { ProfileWithRelations } from '../profiles/repository';
import type { ParsedJob } from './job-parser';
import type { MatchingResult, RequirementMatch } from './requirement-matcher';
import { MatchStrength } from './requirement-matcher';
import { JobRequirementPriority } from './job-parser';

/** Minimal shape of a tailored profile needed for context summaries. */
interface TailoredProfileLike {
  headline: string;
  about: string;
  skills: string[];
  experienceOrder: string[];
  projectOrder: string[];
}

export interface PublicContext {
  profile: PublicProfileContext;
  job: PublicJobContext;
  matching: PublicMatchingContext;
  tailoring: PublicTailoringContext;
  metadata: ContextMetadata;
}

export interface PublicProfileContext {
  headline: string;
  about: string | null;
  skills: string[];
  experienceCount: number;
  educationCount: number;
  projectCount: number;
  topSkills: string[];
}

export interface PublicJobContext {
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean | null;
  requirementCount: number;
  requiredCount: number;
  preferredCount: number;
  categories: string[];
}

export interface PublicMatchingContext {
  matchedCount: number;
  gapCount: number;
  topMatches: PublicMatchSummary[];
  criticalGaps: PublicGapSummary[];
}

export interface PublicMatchSummary {
  requirement: string;
  strength: string;
  evidence: string[];
}

export interface PublicGapSummary {
  requirement: string;
  category: string;
  suggestions: string[];
}

export interface PublicTailoringContext {
  headline: string;
  aboutPreview: string;
  topSkills: string[];
  experienceHighlights: string[];
  projectHighlights: string[];
}

export interface ContextMetadata {
  generatedAt: string;
  version: string;
  includesRawData: boolean;
}

export function buildPublicContext(
  profile: ProfileWithRelations,
  job: ParsedJob,
  matchingResult: MatchingResult,
  tailoredProfile: TailoredProfileLike
): PublicContext {
  return {
    profile: buildProfileContext(profile),
    job: buildJobContext(job),
    matching: buildMatchingContext(matchingResult),
    tailoring: buildTailoringContext(tailoredProfile),
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      includesRawData: false,
    },
  };
}

export function buildProfileContext(profile: ProfileWithRelations): PublicProfileContext {
  const skills = profile.skills.map((s) => s.name);
  const topSkills = skills.slice(0, 10);

  return {
    headline: profile.headline || profile.display_name || '',
    about: profile.about,
    skills,
    experienceCount: profile.experiences.length,
    educationCount: profile.education.length,
    projectCount: profile.projects.length,
    topSkills,
  };
}

export function buildJobContext(job: ParsedJob): PublicJobContext {
  const requiredCount = job.requirements.filter(
    (r) => r.priority === JobRequirementPriority.required
  ).length;
  const preferredCount = job.requirements.filter(
    (r) => r.priority === JobRequirementPriority.preferred
  ).length;

  const categories = [...new Set(job.requirements.map((r) => r.category))];

  return {
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    requirementCount: job.requirements.length,
    requiredCount,
    preferredCount,
    categories,
  };
}

export function buildMatchingContext(matchingResult: MatchingResult): PublicMatchingContext {
  const topMatches = matchingResult.matches
    .filter(
      (m) =>
        m.strength === MatchStrength.exact ||
        m.strength === MatchStrength.strong ||
        m.strength === MatchStrength.moderate
    )
    .sort((a, b) => {
      const strengthOrder: Record<string, number> = {
        exact: 3,
        strong: 2,
        moderate: 1,
        weak: 0,
        none: -1,
      };
      return (strengthOrder[b.strength] || 0) - (strengthOrder[a.strength] || 0);
    })
    .slice(0, 10)
    .map((m) => formatMatchSummary(m));

  const criticalGaps = matchingResult.gaps.slice(0, 5).map((g) => ({
    requirement: g.text,
    category: g.category,
    suggestions: generateSuggestions(g.text, g.category),
  }));

  return {
    matchedCount: matchingResult.summary.matched,
    gapCount: matchingResult.gaps.length,
    topMatches,
    criticalGaps,
  };
}

export function buildTailoringContext(
  tailoredProfile: TailoredProfileLike
): PublicTailoringContext {
  const aboutPreview = tailoredProfile.about
    ? tailoredProfile.about.substring(0, 200) + (tailoredProfile.about.length > 200 ? '...' : '')
    : '';

  return {
    headline: tailoredProfile.headline,
    aboutPreview,
    topSkills: tailoredProfile.skills.slice(0, 10),
    experienceHighlights: tailoredProfile.experienceOrder.slice(0, 3),
    projectHighlights: tailoredProfile.projectOrder.slice(0, 3),
  };
}

export function buildAIPromptContext(
  profile: ProfileWithRelations,
  job: ParsedJob,
  matchingResult: MatchingResult
): string {
  const profileContext = buildProfileContext(profile);
  const jobContext = buildJobContext(job);
  const matchingContext = buildMatchingContext(matchingResult);

  const sections: string[] = [];

  sections.push('=== PROFILE CONTEXT ===');
  sections.push(`Headline: ${profileContext.headline}`);
  sections.push(`Skills: ${profileContext.skills.join(', ')}`);
  sections.push(`Experience: ${profileContext.experienceCount} positions`);
  sections.push(`Education: ${profileContext.educationCount} entries`);
  sections.push(`Projects: ${profileContext.projectCount} projects`);

  if (profileContext.about) {
    sections.push(`About: ${profileContext.about}`);
  }

  sections.push('\n=== JOB CONTEXT ===');
  sections.push(`Title: ${jobContext.title}`);
  if (jobContext.company) {
    sections.push(`Company: ${jobContext.company}`);
  }
  if (jobContext.location) {
    sections.push(`Location: ${jobContext.location}`);
  }
  sections.push(`Requirements: ${jobContext.requirementCount} total`);
  sections.push(`Required: ${jobContext.requiredCount}`);
  sections.push(`Preferred: ${jobContext.preferredCount}`);

  sections.push('\n=== MATCHING CONTEXT ===');
  sections.push(`Matched: ${matchingContext.matchedCount}`);
  sections.push(`Gaps: ${matchingContext.gapCount}`);

  if (matchingContext.topMatches.length > 0) {
    sections.push('\nTop Matches:');
    for (const match of matchingContext.topMatches) {
      sections.push(`  - ${match.requirement} (${match.strength}): ${match.evidence.join(', ')}`);
    }
  }

  if (matchingContext.criticalGaps.length > 0) {
    sections.push('\nCritical Gaps:');
    for (const gap of matchingContext.criticalGaps) {
      sections.push(`  - ${gap.requirement} (${gap.category})`);
      for (const suggestion of gap.suggestions) {
        sections.push(`    * ${suggestion}`);
      }
    }
  }

  sections.push('\n=== EXPERIENCE DETAILS ===');
  for (const exp of profile.experiences.slice(0, 5)) {
    sections.push(
      `- ${exp.role} at ${exp.company} (${exp.start_year}-${exp.is_current ? 'Present' : exp.end_year || 'N/A'})`
    );
    if (exp.description) {
      sections.push(`  ${exp.description.substring(0, 150)}`);
    }
  }

  sections.push('\n=== PROJECT DETAILS ===');
  for (const proj of profile.projects.slice(0, 5)) {
    sections.push(`- ${proj.name}`);
    if (proj.description) {
      sections.push(`  ${proj.description.substring(0, 150)}`);
    }
  }

  return sections.join('\n');
}

export function buildMinimalContext(
  profile: ProfileWithRelations,
  job: ParsedJob
): { profileSummary: string; jobSummary: string } {
  const profileSummary = [
    profile.headline || profile.display_name || 'Unknown',
    profile.skills
      .map((s) => s.name)
      .slice(0, 8)
      .join(', '),
    `${profile.experiences.length} positions`,
  ]
    .filter(Boolean)
    .join(' | ');

  const jobSummary = [job.title, job.company, `${job.requirements.length} requirements`]
    .filter(Boolean)
    .join(' | ');

  return { profileSummary, jobSummary };
}

function formatMatchSummary(match: RequirementMatch): PublicMatchSummary {
  return {
    requirement: match.requirement.text,
    strength: match.strength,
    evidence: match.matchedEvidence,
  };
}

function generateSuggestions(requirementText: string, category: string): string[] {
  const suggestions: string[] = [];

  switch (category) {
    case 'skill':
      suggestions.push(`Highlight projects using ${requirementText}`);
      suggestions.push(`Add ${requirementText} to your skills section`);
      break;
    case 'experience':
      suggestions.push(`Emphasize relevant work experience`);
      suggestions.push(`Include freelance or volunteer work`);
      break;
    case 'education':
      suggestions.push(`List relevant coursework or certifications`);
      suggestions.push(`Highlight self-taught expertise`);
      break;
    case 'certification':
      suggestions.push(`Consider pursuing the certification`);
      suggestions.push(`List in-progress certifications`);
      break;
    case 'softSkill':
      suggestions.push(`Provide specific examples in experience descriptions`);
      suggestions.push(`Include in your about section`);
      break;
    case 'tool':
      suggestions.push(`Add to your skills if you have experience`);
      suggestions.push(`Mention in project descriptions`);
      break;
    default:
      suggestions.push(`Consider how to demonstrate this requirement`);
  }

  return suggestions;
}

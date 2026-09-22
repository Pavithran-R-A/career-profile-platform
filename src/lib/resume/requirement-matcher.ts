import type { ProfileWithRelations } from '../profiles/repository';
import type { JobRequirement, ParsedJob } from './job-parser';
import { JobRequirementCategory, JobRequirementPriority } from './job-parser';

export const MatchStrength = {
  exact: 'exact',
  strong: 'strong',
  moderate: 'moderate',
  weak: 'weak',
  none: 'none',
} as const;

export type MatchStrength = (typeof MatchStrength)[keyof typeof MatchStrength];

export interface RequirementMatch {
  requirement: JobRequirement;
  strength: MatchStrength;
  matchedEvidence: string[];
  gapSuggestions: string[];
}

export interface MatchingResult {
  overallScore: number;
  matches: RequirementMatch[];
  gaps: JobRequirement[];
  summary: {
    totalRequirements: number;
    matched: number;
    partialMatched: number;
    unmatched: number;
    byCategory: Record<JobRequirementCategory, { matched: number; total: number }>;
  };
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProfileSkills(profile: ProfileWithRelations): string[] {
  const skillNames = profile.skills.map((skill) => normalizeForComparison(skill.name));

  const projectTechnologies = profile.projects.flatMap((project) =>
    project.description ? extractTechnologiesFromText(project.description) : []
  );

  const experienceSkills = profile.experiences.flatMap((exp) =>
    exp.description ? extractTechnologiesFromText(exp.description) : []
  );

  return [...new Set([...skillNames, ...projectTechnologies, ...experienceSkills])];
}

function extractTechnologiesFromText(text: string): string[] {
  const techPatterns = [
    /\b(?:javascript|typescript|python|java|c\+\+|c#|ruby|go|rust|php|swift|kotlin)\b/gi,
    /\b(?:react|angular|vue|next\.?js|nuxt|svelte|node\.?js|express|fastify|nest\.?js)\b/gi,
    /\b(?:django|flask|fastapi|spring|rails|laravel|dotnet|asp\.net)\b/gi,
    /\b(?:aws|azure|gcp|google cloud|microsoft azure|amazon web services)\b/gi,
    /\b(?:docker|kubernetes|k8s|terraform|ansible|jenkins|github actions|gitlab ci)\b/gi,
    /\b(?:postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|firebase|supabase)\b/gi,
    /\b(?:graphql|rest|grpc|websocket|http|https|tcp|udp)\b/gi,
    /\b(?:html|css|sass|less|tailwind|bootstrap|material ui|chakra ui)\b/gi,
    /\b(?:git|svn|mercurial|bitbucket|gitlab|github)\b/gi,
    /\b(?:linux|unix|windows|macos|ios|android)\b/gi,
    /\b(?:agile|scrum|kanban|jira|trello|asana|linear)\b/gi,
    /\b(?:figma|sketch|adobe xd|invision|zeplin)\b/gi,
  ];

  const technologies: string[] = [];
  for (const pattern of techPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      technologies.push(...matches.map((m) => normalizeForComparison(m)));
    }
  }
  return technologies;
}

function calculateSkillMatch(
  requirement: JobRequirement,
  profileSkills: string[]
): { strength: MatchStrength; evidence: string[] } {
  const reqNormalized = normalizeForComparison(requirement.text);
  const evidence: string[] = [];

  for (const skill of profileSkills) {
    if (reqNormalized.includes(skill) || skill.includes(reqNormalized)) {
      evidence.push(skill);
    }
  }

  if (evidence.length > 0) {
    return { strength: MatchStrength.exact, evidence };
  }

  for (const skill of profileSkills) {
    const reqWords = reqNormalized.split(' ');
    const skillWords = skill.split(' ');
    const overlap = reqWords.filter((w) => skillWords.includes(w) && w.length > 2);
    if (overlap.length >= 2) {
      evidence.push(skill);
    }
  }

  if (evidence.length > 0) {
    return { strength: MatchStrength.strong, evidence };
  }

  for (const skill of profileSkills) {
    const reqWords = reqNormalized.split(' ');
    const skillWords = skill.split(' ');
    const overlap = reqWords.filter((w) => skillWords.includes(w) && w.length > 3);
    if (overlap.length >= 1) {
      evidence.push(skill);
    }
  }

  if (evidence.length > 0) {
    return { strength: MatchStrength.moderate, evidence };
  }

  return { strength: MatchStrength.none, evidence: [] };
}

function calculateExperienceMatch(
  requirement: JobRequirement,
  profile: ProfileWithRelations
): { strength: MatchStrength; evidence: string[] } {
  const evidence: string[] = [];
  const reqNormalized = normalizeForComparison(requirement.text);

  const yearMatch = reqNormalized.match(/(\d+)\s*(?:\+?\s*)?(?:years?|yrs?)/);
  if (yearMatch) {
    const requiredYears = parseInt(yearMatch[1], 10);
    const totalMonths = profile.experiences.reduce((total, exp) => {
      const start = new Date(exp.start_year, (exp.start_month || 1) - 1);
      const end = exp.is_current
        ? new Date()
        : new Date(exp.end_year || exp.start_year, (exp.end_month || 1) - 1);
      return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    }, 0);
    const totalYears = Math.round(totalMonths / 12);

    if (totalYears >= requiredYears) {
      evidence.push(`${totalYears} years of experience (required: ${requiredYears})`);
      return { strength: MatchStrength.exact, evidence };
    }
    if (totalYears >= requiredYears - 1) {
      evidence.push(`${totalYears} years of experience (required: ${requiredYears})`);
      return { strength: MatchStrength.moderate, evidence };
    }
  }

  for (const exp of profile.experiences) {
    const roleNormalized = normalizeForComparison(exp.role);
    const companyNormalized = normalizeForComparison(exp.company);
    const descNormalized = exp.description ? normalizeForComparison(exp.description) : '';

    if (
      reqNormalized.includes(roleNormalized) ||
      roleNormalized.includes(reqNormalized) ||
      reqNormalized.includes(companyNormalized) ||
      descNormalized.includes(reqNormalized)
    ) {
      evidence.push(`${exp.role} at ${exp.company}`);
    }
  }

  if (evidence.length > 0) {
    return { strength: MatchStrength.strong, evidence };
  }

  return { strength: MatchStrength.none, evidence: [] };
}

function calculateEducationMatch(
  requirement: JobRequirement,
  profile: ProfileWithRelations
): { strength: MatchStrength; evidence: string[] } {
  const evidence: string[] = [];
  const reqNormalized = normalizeForComparison(requirement.text);

  const degreeLevels: Record<string, number> = {
    associate: 1,
    bachelor: 2,
    master: 3,
    phd: 4,
    doctorate: 4,
  };

  let requiredLevel = 2;
  for (const [degree, level] of Object.entries(degreeLevels)) {
    if (reqNormalized.includes(degree)) {
      requiredLevel = level;
      break;
    }
  }

  for (const edu of profile.education) {
    const degreeNormalized = normalizeForComparison(edu.degree || '');
    const fieldNormalized = normalizeForComparison(edu.field_of_study || '');

    let eduLevel = 0;
    for (const [degree, level] of Object.entries(degreeLevels)) {
      if (degreeNormalized.includes(degree)) {
        eduLevel = level;
        break;
      }
    }

    if (eduLevel >= requiredLevel) {
      evidence.push(`${edu.degree || 'Degree'} from ${edu.institution}`);
      continue;
    }

    if (reqNormalized.includes(fieldNormalized) && fieldNormalized.length > 2) {
      evidence.push(`${edu.degree || 'Degree'} in ${edu.field_of_study} from ${edu.institution}`);
    }
  }

  if (evidence.length > 0) {
    return { strength: MatchStrength.exact, evidence };
  }

  return { strength: MatchStrength.none, evidence: [] };
}

function calculateSoftSkillMatch(
  requirement: JobRequirement,
  profile: ProfileWithRelations
): { strength: MatchStrength; evidence: string[] } {
  const evidence: string[] = [];
  const reqNormalized = normalizeForComparison(requirement.text);

  const allText = [
    profile.about || '',
    ...profile.experiences.map((exp) => exp.description || ''),
    ...profile.projects.map((proj) => proj.description || ''),
  ]
    .join(' ')
    .toLowerCase();

  if (allText.includes(reqNormalized)) {
    evidence.push(`Demonstrated in profile content`);
    return { strength: MatchStrength.moderate, evidence };
  }

  const reqWords = reqNormalized.split(' ');
  const textWords = allText.split(' ');
  const overlap = reqWords.filter((w) => textWords.includes(w) && w.length > 3);

  if (overlap.length >= 2) {
    evidence.push(`Keywords found in profile: ${overlap.join(', ')}`);
    return { strength: MatchStrength.weak, evidence };
  }

  return { strength: MatchStrength.none, evidence: [] };
}

function calculateToolMatch(
  requirement: JobRequirement,
  profileSkills: string[]
): { strength: MatchStrength; evidence: string[] } {
  const reqNormalized = normalizeForComparison(requirement.text);
  const evidence: string[] = [];

  for (const skill of profileSkills) {
    if (reqNormalized.includes(skill) || skill.includes(reqNormalized)) {
      evidence.push(skill);
    }
  }

  if (evidence.length > 0) {
    return { strength: MatchStrength.exact, evidence };
  }

  for (const skill of profileSkills) {
    const reqWords = reqNormalized.split(' ');
    const skillWords = skill.split(' ');
    const overlap = reqWords.filter((w) => skillWords.includes(w) && w.length > 2);
    if (overlap.length >= 1) {
      evidence.push(skill);
    }
  }

  if (evidence.length > 0) {
    return { strength: MatchStrength.strong, evidence };
  }

  return { strength: MatchStrength.none, evidence: [] };
}

function matchRequirement(
  requirement: JobRequirement,
  profile: ProfileWithRelations,
  profileSkills: string[]
): RequirementMatch {
  let strength: MatchStrength;
  let matchedEvidence: string[] = [];

  switch (requirement.category) {
    case JobRequirementCategory.skill: {
      const result = calculateSkillMatch(requirement, profileSkills);
      strength = result.strength;
      matchedEvidence = result.evidence;
      break;
    }
    case JobRequirementCategory.experience: {
      const result = calculateExperienceMatch(requirement, profile);
      strength = result.strength;
      matchedEvidence = result.evidence;
      break;
    }
    case JobRequirementCategory.education: {
      const result = calculateEducationMatch(requirement, profile);
      strength = result.strength;
      matchedEvidence = result.evidence;
      break;
    }
    case JobRequirementCategory.softSkill: {
      const result = calculateSoftSkillMatch(requirement, profile);
      strength = result.strength;
      matchedEvidence = result.evidence;
      break;
    }
    case JobRequirementCategory.tool: {
      const result = calculateToolMatch(requirement, profileSkills);
      strength = result.strength;
      matchedEvidence = result.evidence;
      break;
    }
    case JobRequirementCategory.certification: {
      const result = calculateSkillMatch(requirement, profileSkills);
      strength = result.strength;
      matchedEvidence = result.evidence;
      break;
    }
    case JobRequirementCategory.language: {
      const result = calculateSkillMatch(requirement, profileSkills);
      strength = result.strength;
      matchedEvidence = result.evidence;
      break;
    }
    default: {
      const result = calculateSkillMatch(requirement, profileSkills);
      strength = result.strength;
      matchedEvidence = result.evidence;
    }
  }

  const gapSuggestions = generateGapSuggestions(requirement, strength);

  return {
    requirement,
    strength,
    matchedEvidence,
    gapSuggestions,
  };
}

function generateGapSuggestions(requirement: JobRequirement, strength: MatchStrength): string[] {
  if (strength === MatchStrength.exact || strength === MatchStrength.strong) {
    return [];
  }

  const suggestions: string[] = [];
  const reqNormalized = normalizeForComparison(requirement.text);

  switch (requirement.category) {
    case JobRequirementCategory.skill:
      suggestions.push(`Add "${requirement.text}" to your skills if you have experience with it`);
      suggestions.push(`Highlight projects or experience that demonstrate ${reqNormalized}`);
      break;
    case JobRequirementCategory.experience:
      suggestions.push(`Consider emphasizing relevant work experience`);
      suggestions.push(`Include any freelance or volunteer work that matches`);
      break;
    case JobRequirementCategory.education:
      suggestions.push(`Include relevant coursework or online certifications`);
      suggestions.push(`Highlight self-taught skills in this area`);
      break;
    case JobRequirementCategory.certification:
      suggestions.push(`Consider obtaining the required certification`);
      suggestions.push(`List any in-progress certifications`);
      break;
    case JobRequirementCategory.softSkill:
      suggestions.push(`Provide specific examples demonstrating this skill`);
      suggestions.push(`Include this in your experience descriptions`);
      break;
    case JobRequirementCategory.tool:
      suggestions.push(`Add this tool to your skills if you have experience`);
      suggestions.push(`Mention this tool in your project descriptions`);
      break;
    default:
      suggestions.push(`Consider how you can demonstrate this requirement`);
  }

  return suggestions;
}

function calculateOverallScore(matches: RequirementMatch[]): number {
  if (matches.length === 0) return 0;

  const strengthScores: Record<MatchStrength, number> = {
    [MatchStrength.exact]: 100,
    [MatchStrength.strong]: 80,
    [MatchStrength.moderate]: 50,
    [MatchStrength.weak]: 20,
    [MatchStrength.none]: 0,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const match of matches) {
    const weight =
      match.requirement.priority === JobRequirementPriority.required
        ? 3
        : match.requirement.priority === JobRequirementPriority.preferred
          ? 2
          : 1;

    weightedSum += strengthScores[match.strength] * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export function matchRequirements(job: ParsedJob, profile: ProfileWithRelations): MatchingResult {
  const profileSkills = extractProfileSkills(profile);
  const matches = job.requirements.map((req) => matchRequirement(req, profile, profileSkills));

  const gaps = matches
    .filter(
      (m) =>
        m.strength === MatchStrength.none &&
        m.requirement.priority === JobRequirementPriority.required
    )
    .map((m) => m.requirement);

  const byCategory = {} as Record<JobRequirementCategory, { matched: number; total: number }>;
  for (const category of Object.values(JobRequirementCategory)) {
    const categoryMatches = matches.filter((m) => m.requirement.category === category);
    byCategory[category] = {
      matched: categoryMatches.filter(
        (m) => m.strength === MatchStrength.exact || m.strength === MatchStrength.strong
      ).length,
      total: categoryMatches.length,
    };
  }

  return {
    overallScore: calculateOverallScore(matches),
    matches,
    gaps,
    summary: {
      totalRequirements: matches.length,
      matched: matches.filter(
        (m) => m.strength === MatchStrength.exact || m.strength === MatchStrength.strong
      ).length,
      partialMatched: matches.filter(
        (m) => m.strength === MatchStrength.moderate || m.strength === MatchStrength.weak
      ).length,
      unmatched: matches.filter((m) => m.strength === MatchStrength.none).length,
      byCategory,
    },
  };
}

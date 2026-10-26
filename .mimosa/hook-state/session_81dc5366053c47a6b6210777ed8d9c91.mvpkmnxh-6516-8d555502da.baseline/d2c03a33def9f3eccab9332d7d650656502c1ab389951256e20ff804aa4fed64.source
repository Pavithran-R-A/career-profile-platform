import { z } from 'zod';

export const JobRequirementCategory = {
  skill: 'skill',
  experience: 'experience',
  education: 'education',
  certification: 'certification',
  softSkill: 'softSkill',
  tool: 'tool',
  language: 'language',
} as const;

export type JobRequirementCategory =
  (typeof JobRequirementCategory)[keyof typeof JobRequirementCategory];

export const JobRequirementPriority = {
  required: 'required',
  preferred: 'preferred',
  niceToHave: 'niceToHave',
} as const;

export type JobRequirementPriority =
  (typeof JobRequirementPriority)[keyof typeof JobRequirementPriority];

export const jobRequirementSchema = z.object({
  text: z.string().min(1),
  category: z.nativeEnum(JobRequirementCategory),
  priority: z.nativeEnum(JobRequirementPriority),
  keywords: z.array(z.string()),
  normalized: z.string(),
});

export type JobRequirement = z.infer<typeof jobRequirementSchema>;

export const parsedJobSchema = z.object({
  title: z.string().min(1),
  company: z.string().nullable(),
  location: z.string().nullable(),
  remote: z.boolean().nullable(),
  salaryRange: z.string().nullable(),
  summary: z.string().nullable(),
  requirements: z.array(jobRequirementSchema),
  rawText: z.string(),
  parsedAt: z.string().datetime(),
});

export type ParsedJob = z.infer<typeof parsedJobSchema>;

const SKILL_KEYWORDS = [
  'proficient in',
  'experience with',
  'knowledge of',
  'familiarity with',
  'skills in',
  'ability to use',
  'expertise in',
  'background in',
  'hands-on experience',
  'working knowledge',
  'understanding of',
  'competency in',
  'mastery of',
  'fluent in',
  'trained in',
];

const TOOL_KEYWORDS = [
  'using',
  'tools',
  'platforms',
  'software',
  'frameworks',
  'technologies',
  'libraries',
  'systems',
  'applications',
  'environments',
];

const EXPERIENCE_KEYWORDS = [
  'years of experience',
  'years experience',
  'minimum.*experience',
  'at least.*years',
  'experience in',
  'background in',
  'history of',
  'track record',
];

const EDUCATION_KEYWORDS = [
  'degree',
  'bachelor',
  'master',
  'phd',
  'doctorate',
  'associate',
  'diploma',
  'certification',
  'certificate',
  'graduate',
  'undergraduate',
];

const SOFT_SKILL_KEYWORDS = [
  'communication',
  'leadership',
  'teamwork',
  'problem-solving',
  'analytical',
  'creative',
  'adaptable',
  'flexible',
  'detail-oriented',
  'organized',
  'time management',
  'critical thinking',
  'interpersonal',
  'collaborative',
  'self-motivated',
];

const CERTIFICATION_KEYWORDS = [
  'certified',
  'certification',
  'license',
  'credential',
  'aws certified',
  'google certified',
  'microsoft certified',
  'pmp',
  'ci cd',
  'agile',
  'scrum',
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ');
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'shall',
    'can',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'we',
    'our',
    'you',
    'your',
    'they',
    'their',
    'he',
    'she',
    'his',
    'her',
    'my',
    'i',
    'me',
    'us',
    'them',
  ]);

  return words.filter((word) => word.length > 2 && !stopWords.has(word));
}

function detectCategory(text: string): JobRequirementCategory {
  const normalized = normalizeText(text);

  if (CERTIFICATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return JobRequirementCategory.certification;
  }

  if (SOFT_SKILL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return JobRequirementCategory.softSkill;
  }

  if (TOOL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return JobRequirementCategory.tool;
  }

  if (SKILL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return JobRequirementCategory.skill;
  }

  if (EXPERIENCE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return JobRequirementCategory.experience;
  }

  if (EDUCATION_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return JobRequirementCategory.education;
  }

  return JobRequirementCategory.skill;
}

function detectPriority(text: string): JobRequirementPriority {
  const normalized = normalizeText(text);

  if (
    normalized.includes('required') ||
    normalized.includes('must have') ||
    normalized.includes('essential') ||
    normalized.includes('mandatory')
  ) {
    return JobRequirementPriority.required;
  }

  if (
    normalized.includes('preferred') ||
    normalized.includes('desired') ||
    normalized.includes('plus')
  ) {
    return JobRequirementPriority.preferred;
  }

  if (
    normalized.includes('nice to have') ||
    normalized.includes('bonus') ||
    normalized.includes('advantage')
  ) {
    return JobRequirementPriority.niceToHave;
  }

  return JobRequirementPriority.required;
}

function parseRequirements(text: string): JobRequirement[] {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const requirements: JobRequirement[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5) continue;

    const hasBulletPoint =
      trimmed.startsWith('•') ||
      trimmed.startsWith('-') ||
      trimmed.startsWith('*') ||
      /^\d+\./.test(trimmed);

    if (!hasBulletPoint && !SKILL_KEYWORDS.some((kw) => trimmed.toLowerCase().includes(kw))) {
      continue;
    }

    const cleanText = trimmed.replace(/^[\s•\-\*\d\.]+/, '').trim();
    if (cleanText.length < 3) continue;

    requirements.push({
      text: cleanText,
      category: detectCategory(cleanText),
      priority: detectPriority(cleanText),
      keywords: extractKeywords(cleanText),
      normalized: normalizeText(cleanText),
    });
  }

  return requirements;
}

function extractJobTitle(text: string): string {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.length < 100) {
      const lower = trimmed.toLowerCase();
      if (
        lower.includes('engineer') ||
        lower.includes('developer') ||
        lower.includes('manager') ||
        lower.includes('designer') ||
        lower.includes('analyst') ||
        lower.includes('architect') ||
        lower.includes('lead') ||
        lower.includes('senior') ||
        lower.includes('junior') ||
        lower.includes('intern') ||
        lower.includes('specialist') ||
        lower.includes('consultant') ||
        lower.includes('director') ||
        lower.includes('coordinator')
      ) {
        return trimmed;
      }
    }
  }
  return lines[0]?.trim() || 'Unknown Position';
}

function extractCompany(text: string): string | null {
  const companyPatterns = [
    /company[:\s]+([^\n,]+)/i,
    /organization[:\s]+([^\n,]+)/i,
    /employer[:\s]+([^\n,]+)/i,
    /at\s+([A-Z][a-zA-Z\s&]+(?:Inc|LLC|Corp|Ltd|Co|Group|Solutions|Technologies|Labs))/,
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  for (const line of lines.slice(0, 3)) {
    const trimmed = line.trim();
    if (trimmed.length > 2 && trimmed.length < 50 && /^[A-Z]/.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      if (
        !lower.includes('engineer') &&
        !lower.includes('developer') &&
        !lower.includes('manager') &&
        !lower.includes('position') &&
        !lower.includes('role') &&
        !lower.includes('job')
      ) {
        return trimmed;
      }
    }
  }

  return null;
}

function extractLocation(text: string): string | null {
  const locationPatterns = [
    /location[:\s]+([^\n,]+)/i,
    /based in[:\s]+([^\n,]+)/i,
    /office[:\s]+([^\n,]+)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractRemote(text: string): boolean | null {
  const normalized = text.toLowerCase();
  if (normalized.includes('remote') || normalized.includes('work from home')) {
    return true;
  }
  if (
    normalized.includes('on-site') ||
    normalized.includes('onsite') ||
    normalized.includes('in office')
  ) {
    return false;
  }
  if (normalized.includes('hybrid')) {
    return null;
  }
  return null;
}

function extractSalary(text: string): string | null {
  const salaryPatterns = [
    /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per|\/)\s*(?:year|annum|month|hour|hr))?/i,
    /salary[:\s]+([^\n,]+)/i,
    /compensation[:\s]+([^\n,]+)/i,
  ];

  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      return match[0].trim();
    }
  }

  return null;
}

function extractSummary(text: string): string | null {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const summaryLines: string[] = [];
  let foundSummary = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (
      lower.includes('about the role') ||
      lower.includes('job description') ||
      lower.includes('overview') ||
      lower.includes('about us') ||
      lower.includes('about the company')
    ) {
      foundSummary = true;
      continue;
    }

    if (foundSummary) {
      if (
        lower.includes('requirements') ||
        lower.includes('qualifications') ||
        lower.includes('responsibilities') ||
        lower.includes('benefits') ||
        lower.includes('what we offer')
      ) {
        break;
      }
      summaryLines.push(trimmed);
      if (summaryLines.length >= 5) break;
    }
  }

  return summaryLines.length > 0 ? summaryLines.join(' ') : null;
}

export function parseJobDescription(text: string): ParsedJob {
  const requirements = parseRequirements(text);

  return parsedJobSchema.parse({
    title: extractJobTitle(text),
    company: extractCompany(text),
    location: extractLocation(text),
    remote: extractRemote(text),
    salaryRange: extractSalary(text),
    summary: extractSummary(text),
    requirements,
    rawText: text,
    parsedAt: new Date().toISOString(),
  });
}

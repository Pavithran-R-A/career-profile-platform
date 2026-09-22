import { describe, it, expect } from 'vitest';

// ─── Job Parser Types ─────────────────────────────────────────

interface ParsedJob {
  jobTitle: string;
  companyName: string;
  location: string | null;
  employmentType: string | null;
  requirements: string[];
  niceToHaves: string[];
  responsibilities: string[];
  rawText: string;
}

// ─── Job Parser Logic ─────────────────────────────────────────

function parseJobDescription(text: string): ParsedJob {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let jobTitle = '';
  let companyName = '';
  let location: string | null = null;
  let employmentType: string | null = null;
  const requirements: string[] = [];
  const niceToHaves: string[] = [];
  const responsibilities: string[] = [];

  let currentSection: 'requirements' | 'nice_to_have' | 'responsibilities' | 'none' = 'none';

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (
      lower.startsWith('job title') ||
      lower.startsWith('position') ||
      lower.startsWith('role:')
    ) {
      const match = line.match(/[:\-]\s*(.+)/i);
      if (match) jobTitle = match[1].trim();
      continue;
    }

    if (
      lower.startsWith('company') ||
      lower.startsWith('employer') ||
      lower.startsWith('organization')
    ) {
      const match = line.match(/[:\-]\s*(.+)/i);
      if (match) companyName = match[1].trim();
      continue;
    }

    if (lower.startsWith('location:') || lower.startsWith('location -')) {
      const match = line.match(/[:\-]\s*(.+)/i);
      if (match) location = match[1].trim();
      continue;
    }

    if (lower.startsWith('type:') || lower.startsWith('employment type')) {
      const match = line.match(/[:\-]\s*(.+)/i);
      if (match) employmentType = match[1].trim();
      continue;
    }

    if (
      lower.includes('requirements') ||
      lower.includes('qualifications') ||
      lower.includes('must have') ||
      lower.includes('required skills')
    ) {
      currentSection = 'requirements';
      if (lower.includes('nice to have') || lower.includes('preferred')) {
        currentSection = 'nice_to_have';
      }
      continue;
    }

    if (
      lower.includes('responsibilities') ||
      lower.includes('what you will do') ||
      lower.includes('duties')
    ) {
      currentSection = 'responsibilities';
      continue;
    }

    if (
      lower.startsWith('nice to have') ||
      lower.startsWith('preferred qualifications') ||
      lower.startsWith('bonus')
    ) {
      currentSection = 'nice_to_have';
      continue;
    }

    const isListItem =
      lower.startsWith('-') ||
      lower.startsWith('•') ||
      lower.startsWith('*') ||
      lower.startsWith('–');

    if (isListItem) {
      const item = line.replace(/^[\-\•\*\–]\s*/, '').trim();
      if (item.length > 3) {
        switch (currentSection) {
          case 'requirements':
            requirements.push(item);
            break;
          case 'nice_to_have':
            niceToHaves.push(item);
            break;
          case 'responsibilities':
            responsibilities.push(item);
            break;
          default:
            requirements.push(item);
            break;
        }
      }
    }
  }

  if (!jobTitle && lines.length > 0) {
    jobTitle = lines[0];
  }
  if (!companyName && lines.length > 1) {
    const secondLine = lines[1];
    if (!secondLine.startsWith('-') && !secondLine.startsWith('•')) {
      companyName = secondLine;
    }
  }

  return {
    jobTitle,
    companyName,
    location,
    employmentType,
    requirements,
    niceToHaves,
    responsibilities,
    rawText: text,
  };
}

function extractKeywords(text: string): string[] {
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
    'as',
    'is',
    'was',
    'are',
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
    'can',
    'shall',
    'must',
    'that',
    'this',
    'these',
    'those',
    'it',
    'its',
    'we',
    'you',
    'they',
    'our',
    'your',
    'their',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'when',
    'where',
    'why',
    'how',
    'all',
    'both',
    'each',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\+#]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  const frequency = new Map<string, number>();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

function detectEmploymentType(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('full-time') || lower.includes('full time')) return 'Full-time';
  if (lower.includes('part-time') || lower.includes('part time')) return 'Part-time';
  if (lower.includes('contract')) return 'Contract';
  if (lower.includes('freelance')) return 'Freelance';
  if (lower.includes('internship') || lower.includes('intern')) return 'Internship';
  if (lower.includes('temporary') || lower.includes('temp')) return 'Temporary';
  return null;
}

// ─── Tests ────────────────────────────────────────────────────

describe('Job Parser - parseJobDescription', () => {
  const fullJobPosting = `Senior Frontend Engineer
TechCorp Inc.
Location: Remote
Type: Full-time

Responsibilities:
- Build and maintain React applications
- Mentor junior developers
- Participate in code reviews

Requirements:
- 5+ years of frontend development experience
- Strong TypeScript skills
- Experience with React and Redux
- Understanding of web accessibility

Nice to Have:
- Experience with Next.js
- Knowledge of GraphQL
- AWS certifications`;

  it('extracts job title from header', () => {
    const result = parseJobDescription(fullJobPosting);
    expect(result.jobTitle).toBe('Senior Frontend Engineer');
  });

  it('extracts company name from second line', () => {
    const result = parseJobDescription(fullJobPosting);
    expect(result.companyName).toBe('TechCorp Inc.');
  });

  it('extracts location', () => {
    const result = parseJobDescription(fullJobPosting);
    expect(result.location).toBe('Remote');
  });

  it('extracts employment type', () => {
    const result = parseJobDescription(fullJobPosting);
    expect(result.employmentType).toBe('Full-time');
  });

  it('extracts requirements', () => {
    const result = parseJobDescription(fullJobPosting);
    expect(result.requirements).toHaveLength(4);
    expect(result.requirements[0]).toContain('5+ years');
  });

  it('extracts nice-to-haves', () => {
    const result = parseJobDescription(fullJobPosting);
    expect(result.niceToHaves).toHaveLength(3);
    expect(result.niceToHaves[0]).toContain('Next.js');
  });

  it('extracts responsibilities', () => {
    const result = parseJobDescription(fullJobPosting);
    expect(result.responsibilities).toHaveLength(3);
    expect(result.responsibilities[0]).toContain('React applications');
  });

  it('handles job posting without structured headers', () => {
    const text = `Software Developer
Acme Corp

- Write clean code
- Work with the team
- Deliver features on time`;
    const result = parseJobDescription(text);
    expect(result.jobTitle).toBe('Software Developer');
    expect(result.companyName).toBe('Acme Corp');
  });

  it('handles empty text', () => {
    const result = parseJobDescription('');
    expect(result.jobTitle).toBe('');
    expect(result.requirements).toHaveLength(0);
  });

  it('handles text with only list items', () => {
    const text = `- First requirement
- Second requirement
- Third requirement`;
    const result = parseJobDescription(text);
    expect(result.requirements).toHaveLength(3);
  });

  it('preserves raw text', () => {
    const text = 'Job Title\nCompany\n- Requirement';
    const result = parseJobDescription(text);
    expect(result.rawText).toBe(text);
  });

  it('detects contract employment type', () => {
    const text = `Developer
Company
Type: Contract
- Build things`;
    const result = parseJobDescription(text);
    expect(result.employmentType).toBe('Contract');
  });

  it('detects internship employment type', () => {
    const text = `Intern
Company
Type: Internship
- Learn stuff`;
    const result = parseJobDescription(text);
    expect(result.employmentType).toBe('Internship');
  });

  it('returns null for unknown employment type', () => {
    const text = `Developer
Company
- Build things`;
    const result = parseJobDescription(text);
    expect(result.employmentType).toBeNull();
  });
});

describe('Job Parser - extractKeywords', () => {
  it('extracts top keywords by frequency', () => {
    const text = 'TypeScript React JavaScript TypeScript React development TypeScript';
    const keywords = extractKeywords(text);
    expect(keywords).toContain('typescript');
    expect(keywords).toContain('react');
    expect(keywords).toContain('javascript');
  });

  it('filters out stop words', () => {
    const text = 'the the the and or but software development engineer';
    const keywords = extractKeywords(text);
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('and');
    expect(keywords).not.toContain('or');
  });

  it('returns at most 20 keywords', () => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const keywords = extractKeywords(text);
    expect(keywords.length).toBeLessThanOrEqual(20);
  });

  it('handles empty text', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('is case-insensitive', () => {
    const text = 'TypeScript TYPESCRIPT typescript';
    const keywords = extractKeywords(text);
    expect(keywords.filter((k) => k === 'typescript')).toHaveLength(1);
  });

  it('preserves special characters like + and #', () => {
    const text = 'C++ C# TypeScript JavaScript';
    const keywords = extractKeywords(text);
    expect(keywords).toContain('c++');
    expect(keywords).toContain('c#');
  });
});

describe('Job Parser - detectEmploymentType', () => {
  it('detects full-time', () => {
    expect(detectEmploymentType('This is a full-time position')).toBe('Full-time');
  });

  it('detects part-time', () => {
    expect(detectEmploymentType('Part-time role available')).toBe('Part-time');
  });

  it('detects contract', () => {
    expect(detectEmploymentType('Contract position for 6 months')).toBe('Contract');
  });

  it('detects freelance', () => {
    expect(detectEmploymentType('Freelance opportunity')).toBe('Freelance');
  });

  it('detects internship', () => {
    expect(detectEmploymentType('Summer internship program')).toBe('Internship');
  });

  it('detects temporary', () => {
    expect(detectEmploymentType('Temporary position')).toBe('Temporary');
  });

  it('returns null for unknown type', () => {
    expect(detectEmploymentType('Great opportunity to join our team')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(detectEmploymentType('FULL-TIME position')).toBe('Full-time');
  });
});

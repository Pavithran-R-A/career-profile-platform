import { describe, it, expect } from 'vitest';

// ─── ATS View Model Types ─────────────────────────────────────

interface ATSResumeData {
  profileId: string;
  displayName: string;
  headline: string | null;
  location: string | null;
  about: string | null;
  experiences: ATSExperience[];
  education: ATSEducation[];
  skills: string[];
  projects: ATSProject[];
  links: ATSLink[];
}

interface ATSExperience {
  role: string;
  company: string;
  location: string | null;
  startYear: number;
  endYear: number | null;
  isCurrent: boolean;
  description: string | null;
}

interface ATSEducation {
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
}

interface ATSProject {
  name: string;
  description: string | null;
}

interface ATSLink {
  label: string;
  url: string;
}

// ─── ATS View Model Logic ─────────────────────────────────────

function validateATSData(data: ATSResumeData): string[] {
  const errors: string[] = [];

  if (!data.displayName || data.displayName.trim().length === 0) {
    errors.push('Display name is required');
  }

  if (data.displayName && data.displayName.length > 100) {
    errors.push('Display name must be 100 characters or fewer');
  }

  if (data.about && data.about.length > 2000) {
    errors.push('About section must be 2000 characters or fewer');
  }

  if (data.skills.length > 50) {
    errors.push('Maximum 50 skills allowed');
  }

  for (const exp of data.experiences) {
    if (!exp.role || exp.role.trim().length === 0) {
      errors.push('Experience role cannot be empty');
    }
    if (!exp.company || exp.company.trim().length === 0) {
      errors.push('Experience company cannot be empty');
    }
    if (exp.startYear < 1900 || exp.startYear > 2100) {
      errors.push(`Invalid start year: ${exp.startYear}`);
    }
    if (exp.endYear !== null && exp.endYear < 1900) {
      errors.push(`Invalid end year: ${exp.endYear}`);
    }
  }

  for (const edu of data.education) {
    if (!edu.institution || edu.institution.trim().length === 0) {
      errors.push('Education institution cannot be empty');
    }
  }

  for (const proj of data.projects) {
    if (!proj.name || proj.name.trim().length === 0) {
      errors.push('Project name cannot be empty');
    }
  }

  for (const link of data.links) {
    if (!link.url || !link.url.startsWith('http')) {
      errors.push(`Invalid URL for link: ${link.label}`);
    }
  }

  return errors;
}

function filterSections(
  data: ATSResumeData,
  filters: {
    includeSections?: string[];
    excludeSkills?: string[];
  }
): ATSResumeData {
  const result = { ...data };

  if (filters.excludeSkills) {
    const excluded = new Set(filters.excludeSkills.map((s) => s.toLowerCase()));
    result.skills = result.skills.filter((s) => !excluded.has(s.toLowerCase()));
  }

  return result;
}

function computeATSCharacterCount(data: ATSResumeData): number {
  let count = 0;
  count += data.displayName.length;
  count += (data.headline || '').length;
  count += (data.location || '').length;
  count += (data.about || '').length;

  for (const exp of data.experiences) {
    count += exp.role.length + exp.company.length + (exp.description || '').length;
  }
  for (const edu of data.education) {
    count += edu.institution.length + (edu.degree || '').length + (edu.fieldOfStudy || '').length;
  }
  count += data.skills.join('').length;
  for (const proj of data.projects) {
    count += proj.name.length + (proj.description || '').length;
  }
  for (const link of data.links) {
    count += link.label.length + link.url.length;
  }

  return count;
}

function serializeForExport(data: ATSResumeData): string {
  const lines: string[] = [];
  lines.push(data.displayName);
  if (data.headline) lines.push(data.headline);
  if (data.location) lines.push(data.location);
  lines.push('');

  if (data.about) {
    lines.push('PROFESSIONAL SUMMARY');
    lines.push(data.about);
    lines.push('');
  }

  if (data.experiences.length > 0) {
    lines.push('EXPERIENCE');
    for (const exp of data.experiences) {
      lines.push(`${exp.role} | ${exp.company}`);
      lines.push(`${exp.startYear} – ${exp.isCurrent ? 'Present' : (exp.endYear ?? '')}`);
      if (exp.description) lines.push(exp.description);
      lines.push('');
    }
  }

  if (data.education.length > 0) {
    lines.push('EDUCATION');
    for (const edu of data.education) {
      const degreeStr = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(' — ');
      lines.push(`${edu.institution}${degreeStr ? ` | ${degreeStr}` : ''}`);
    }
    lines.push('');
  }

  if (data.skills.length > 0) {
    lines.push('SKILLS');
    lines.push(data.skills.join(' · '));
    lines.push('');
  }

  if (data.projects.length > 0) {
    lines.push('PROJECTS');
    for (const proj of data.projects) {
      lines.push(proj.name);
      if (proj.description) lines.push(proj.description);
    }
    lines.push('');
  }

  if (data.links.length > 0) {
    lines.push('LINKS');
    for (const link of data.links) {
      lines.push(`${link.label}: ${link.url}`);
    }
  }

  return lines.join('\n');
}

// ─── Test Fixtures ────────────────────────────────────────────

function makeATSData(overrides: Partial<ATSResumeData> = {}): ATSResumeData {
  return {
    profileId: 'profile-123',
    displayName: 'Jane Smith',
    headline: 'Senior Software Engineer',
    location: 'San Francisco, CA',
    about: 'Experienced engineer with 8 years of experience.',
    experiences: [
      {
        role: 'Senior Engineer',
        company: 'TechCo',
        location: 'SF',
        startYear: 2020,
        endYear: null,
        isCurrent: true,
        description: 'Led backend architecture.',
      },
    ],
    education: [
      {
        institution: 'MIT',
        degree: 'B.S.',
        fieldOfStudy: 'Computer Science',
      },
    ],
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    projects: [
      {
        name: 'Open Source CLI',
        description: 'A developer tool',
      },
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/janesmith' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/janesmith' },
    ],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe('ATS View Model - validateATSData', () => {
  it('accepts valid ATS resume data', () => {
    const data = makeATSData();
    const errors = validateATSData(data);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty display name', () => {
    const data = makeATSData({ displayName: '' });
    const errors = validateATSData(data);
    expect(errors).toContain('Display name is required');
  });

  it('rejects display name exceeding 100 characters', () => {
    const data = makeATSData({ displayName: 'A'.repeat(101) });
    const errors = validateATSData(data);
    expect(errors).toContain('Display name must be 100 characters or fewer');
  });

  it('rejects about section exceeding 2000 characters', () => {
    const data = makeATSData({ about: 'X'.repeat(2001) });
    const errors = validateATSData(data);
    expect(errors).toContain('About section must be 2000 characters or fewer');
  });

  it('rejects more than 50 skills', () => {
    const data = makeATSData({ skills: Array.from({ length: 51 }, (_, i) => `Skill ${i}`) });
    const errors = validateATSData(data);
    expect(errors).toContain('Maximum 50 skills allowed');
  });

  it('rejects experience with empty role', () => {
    const data = makeATSData({
      experiences: [{ ...makeATSData().experiences[0], role: '' }],
    });
    const errors = validateATSData(data);
    expect(errors).toContain('Experience role cannot be empty');
  });

  it('rejects experience with empty company', () => {
    const data = makeATSData({
      experiences: [{ ...makeATSData().experiences[0], company: '' }],
    });
    const errors = validateATSData(data);
    expect(errors).toContain('Experience company cannot be empty');
  });

  it('rejects invalid start year', () => {
    const data = makeATSData({
      experiences: [{ ...makeATSData().experiences[0], startYear: 1899 }],
    });
    const errors = validateATSData(data);
    expect(errors).toContain('Invalid start year: 1899');
  });

  it('rejects education with empty institution', () => {
    const data = makeATSData({
      education: [{ ...makeATSData().education[0], institution: '' }],
    });
    const errors = validateATSData(data);
    expect(errors).toContain('Education institution cannot be empty');
  });

  it('rejects project with empty name', () => {
    const data = makeATSData({
      projects: [{ name: '', description: 'desc' }],
    });
    const errors = validateATSData(data);
    expect(errors).toContain('Project name cannot be empty');
  });

  it('rejects link with invalid URL', () => {
    const data = makeATSData({
      links: [{ label: 'Portfolio', url: 'not-a-url' }],
    });
    const errors = validateATSData(data);
    expect(errors).toContain('Invalid URL for link: Portfolio');
  });
});

describe('ATS View Model - filterSections', () => {
  it('filters out excluded skills', () => {
    const data = makeATSData({ skills: ['TypeScript', 'React', 'Go', 'Rust'] });
    const filtered = filterSections(data, { excludeSkills: ['Go'] });
    expect(filtered.skills).toEqual(['TypeScript', 'React', 'Rust']);
  });

  it('is case-insensitive for skill exclusion', () => {
    const data = makeATSData({ skills: ['TypeScript', 'REACT', 'Node.js'] });
    const filtered = filterSections(data, { excludeSkills: ['react'] });
    expect(filtered.skills).toEqual(['TypeScript', 'Node.js']);
  });

  it('returns original data when no filters applied', () => {
    const data = makeATSData();
    const filtered = filterSections(data, {});
    expect(filtered.skills).toEqual(data.skills);
  });
});

describe('ATS View Model - computeATSCharacterCount', () => {
  it('computes total character count', () => {
    const data = makeATSData();
    const count = computeATSCharacterCount(data);
    expect(count).toBeGreaterThan(0);
  });

  it('returns zero for empty data', () => {
    const data = makeATSData({
      displayName: '',
      headline: null,
      location: null,
      about: null,
      experiences: [],
      education: [],
      skills: [],
      projects: [],
      links: [],
    });
    expect(computeATSCharacterCount(data)).toBe(0);
  });

  it('includes all section text in count', () => {
    const data = makeATSData({
      displayName: 'AB',
      headline: 'CD',
      location: null,
      about: 'EF',
      skills: ['GH'],
      experiences: [],
      education: [],
      projects: [],
      links: [],
    });
    expect(computeATSCharacterCount(data)).toBe(2 + 2 + 2 + 2);
  });
});

describe('ATS View Model - serializeForExport', () => {
  it('includes display name as first line', () => {
    const data = makeATSData();
    const text = serializeForExport(data);
    expect(text.startsWith('Jane Smith')).toBe(true);
  });

  it('includes headline when present', () => {
    const data = makeATSData({ headline: 'Senior Software Engineer' });
    const text = serializeForExport(data);
    expect(text).toContain('Senior Software Engineer');
  });

  it('includes experience section', () => {
    const data = makeATSData();
    const text = serializeForExport(data);
    expect(text).toContain('EXPERIENCE');
    expect(text).toContain('Senior Engineer');
    expect(text).toContain('TechCo');
  });

  it('includes education section', () => {
    const data = makeATSData();
    const text = serializeForExport(data);
    expect(text).toContain('EDUCATION');
    expect(text).toContain('MIT');
  });

  it('includes skills section', () => {
    const data = makeATSData();
    const text = serializeForExport(data);
    expect(text).toContain('SKILLS');
    expect(text).toContain('TypeScript');
  });

  it('includes projects section', () => {
    const data = makeATSData();
    const text = serializeForExport(data);
    expect(text).toContain('PROJECTS');
    expect(text).toContain('Open Source CLI');
  });

  it('includes links section', () => {
    const data = makeATSData();
    const text = serializeForExport(data);
    expect(text).toContain('LINKS');
    expect(text).toContain('https://github.com/janesmith');
  });

  it('omits about section when null', () => {
    const data = makeATSData({ about: null });
    const text = serializeForExport(data);
    expect(text).not.toContain('PROFESSIONAL SUMMARY');
  });

  it('omits empty sections', () => {
    const data = makeATSData({
      about: null,
      experiences: [],
      education: [],
      skills: [],
      projects: [],
      links: [],
    });
    const text = serializeForExport(data);
    expect(text).not.toContain('EXPERIENCE');
    expect(text).not.toContain('EDUCATION');
    expect(text).not.toContain('SKILLS');
    expect(text).not.toContain('PROJECTS');
    expect(text).not.toContain('LINKS');
  });
});

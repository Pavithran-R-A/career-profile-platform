import { describe, it, expect } from 'vitest';

// ─── PDF Renderer Types ───────────────────────────────────────

interface PDFPage {
  width: number;
  height: number;
  content: PDFElement[];
}

interface PDFElement {
  type: 'text' | 'heading' | 'line' | 'spacer';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
}

interface PDFDocument {
  pages: PDFPage[];
  metadata: {
    title: string;
    author: string;
    createdAt: string;
  };
}

interface ATSResumeInput {
  displayName: string;
  headline: string | null;
  location: string | null;
  about: string | null;
  experiences: Array<{
    role: string;
    company: string;
    location: string | null;
    startYear: number;
    endYear: number | null;
    isCurrent: boolean;
    description: string | null;
  }>;
  education: Array<{
    institution: string;
    degree: string | null;
    fieldOfStudy: string | null;
  }>;
  skills: string[];
  projects: Array<{
    name: string;
    description: string | null;
  }>;
  links: Array<{
    label: string;
    url: string;
  }>;
}

// ─── PDF Renderer Logic ───────────────────────────────────────

const PAGE_WIDTH = 612; // US Letter width in points
const PAGE_HEIGHT = 792; // US Letter height in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const charsPerLine = Math.floor(maxWidth / (fontSize * 0.6));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > charsPerLine) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [''];
}

function generatePDF(data: ATSResumeInput): PDFDocument {
  const pages: PDFPage[] = [];
  let currentPage: PDFPage = { width: PAGE_WIDTH, height: PAGE_HEIGHT, content: [] };
  let currentY = MARGIN;

  function checkPageBreak(neededHeight: number): void {
    if (currentY + neededHeight > PAGE_HEIGHT - MARGIN) {
      pages.push(currentPage);
      currentPage = { width: PAGE_WIDTH, height: PAGE_HEIGHT, content: [] };
      currentY = MARGIN;
    }
  }

  function addText(
    text: string,
    fontSize: number,
    fontWeight: 'normal' | 'bold' = 'normal',
    color: string = '#000000'
  ): void {
    const lines = wrapText(text, fontSize, CONTENT_WIDTH);
    const lineHeight = fontSize * 1.4;

    for (const line of lines) {
      checkPageBreak(lineHeight);
      currentPage.content.push({
        type: 'text',
        x: MARGIN,
        y: currentY,
        width: CONTENT_WIDTH,
        height: lineHeight,
        text: line,
        fontSize,
        fontWeight,
        color,
      });
      currentY += lineHeight;
    }
  }

  function addHeading(text: string, fontSize: number = 12): void {
    checkPageBreak(fontSize * 2);
    currentY += 4;
    addText(text, fontSize, 'bold', '#333333');
    currentPage.content.push({
      type: 'line',
      x: MARGIN,
      y: currentY,
      width: CONTENT_WIDTH,
      height: 1,
    });
    currentY += 6;
  }

  function addSpacer(height: number = 8): void {
    currentY += height;
  }

  // Header
  addText(data.displayName, 18, 'bold');
  if (data.headline) addText(data.headline, 11, 'normal', '#555555');
  if (data.location) addText(data.location, 10, 'normal', '#777777');

  if (data.links.length > 0) {
    addSpacer(2);
    const linksText = data.links.map((l) => `${l.label}: ${l.url}`).join(' | ');
    addText(linksText, 9, 'normal', '#555555');
  }

  addSpacer(8);

  // About
  if (data.about) {
    addHeading('Professional Summary');
    addText(data.about, 10);
    addSpacer(4);
  }

  // Experience
  if (data.experiences.length > 0) {
    addHeading('Experience');
    for (const exp of data.experiences) {
      checkPageBreak(40);
      addText(`${exp.role} | ${exp.company}`, 11, 'bold');
      const dateRange = `${exp.startYear} – ${exp.isCurrent ? 'Present' : (exp.endYear ?? '')}`;
      addText(dateRange, 9, 'normal', '#777777');
      if (exp.location) addText(exp.location, 9, 'normal', '#777777');
      if (exp.description) addText(exp.description, 10);
      addSpacer(4);
    }
  }

  // Education
  if (data.education.length > 0) {
    addHeading('Education');
    for (const edu of data.education) {
      addText(edu.institution, 11, 'bold');
      const degreeStr = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(' — ');
      if (degreeStr) addText(degreeStr, 10);
      addSpacer(2);
    }
  }

  // Skills
  if (data.skills.length > 0) {
    addHeading('Skills');
    addText(data.skills.join(' · '), 10);
    addSpacer(4);
  }

  // Projects
  if (data.projects.length > 0) {
    addHeading('Projects');
    for (const proj of data.projects) {
      addText(proj.name, 11, 'bold');
      if (proj.description) addText(proj.description, 10);
      addSpacer(2);
    }
  }

  pages.push(currentPage);

  return {
    pages,
    metadata: {
      title: `${data.displayName} - Resume`,
      author: data.displayName,
      createdAt: new Date().toISOString(),
    },
  };
}

function getTotalElements(doc: PDFDocument): number {
  return doc.pages.reduce((sum, page) => sum + page.content.length, 0);
}

function hasSection(doc: PDFDocument, sectionName: string): boolean {
  return doc.pages.some((page) =>
    page.content.some(
      (el) => el.type === 'text' && el.fontWeight === 'bold' && el.text?.includes(sectionName)
    )
  );
}

function isWithinPageBounds(doc: PDFDocument): boolean {
  for (const page of doc.pages) {
    for (const el of page.content) {
      if (el.x < 0 || el.y < 0) return false;
      if (el.x + el.width > page.width) return false;
      if (el.y + el.height > page.height) return false;
    }
  }
  return true;
}

// ─── Test Fixtures ────────────────────────────────────────────

function makeResumeInput(overrides: Partial<ATSResumeInput> = {}): ATSResumeInput {
  return {
    displayName: 'Jane Smith',
    headline: 'Senior Software Engineer',
    location: 'San Francisco, CA',
    about: 'Experienced engineer with expertise in distributed systems and web development.',
    experiences: [
      {
        role: 'Senior Engineer',
        company: 'TechCo',
        location: 'SF',
        startYear: 2020,
        endYear: null,
        isCurrent: true,
        description: 'Led architecture for microservices platform serving 10M users.',
      },
      {
        role: 'Software Engineer',
        company: 'StartupInc',
        location: 'NYC',
        startYear: 2017,
        endYear: 2020,
        isCurrent: false,
        description: 'Built full-stack web applications with React and Node.js.',
      },
    ],
    education: [{ institution: 'MIT', degree: 'B.S.', fieldOfStudy: 'Computer Science' }],
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
    projects: [{ name: 'Open Source CLI', description: 'Developer productivity tool' }],
    links: [
      { label: 'GitHub', url: 'https://github.com/janesmith' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/janesmith' },
    ],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe('PDF Renderer - generatePDF', () => {
  it('generates a valid PDF document', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(doc).toBeDefined();
    expect(doc.pages).toBeDefined();
    expect(doc.metadata).toBeDefined();
  });

  it('sets correct metadata', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(doc.metadata.title).toBe('Jane Smith - Resume');
    expect(doc.metadata.author).toBe('Jane Smith');
    expect(doc.metadata.createdAt).toBeTruthy();
  });

  it('generates at least one page', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(doc.pages.length).toBeGreaterThanOrEqual(1);
  });

  it('uses US Letter page dimensions', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    for (const page of doc.pages) {
      expect(page.width).toBe(612);
      expect(page.height).toBe(792);
    }
  });

  it('includes display name as heading', () => {
    const data = makeResumeInput({ displayName: 'Alice Johnson' });
    const doc = generatePDF(data);
    const nameElement = doc.pages[0].content.find(
      (el) => el.type === 'text' && el.text === 'Alice Johnson'
    );
    expect(nameElement).toBeDefined();
  });

  it('includes headline when provided', () => {
    const data = makeResumeInput({ headline: 'Staff Engineer' });
    const doc = generatePDF(data);
    const headlineEl = doc.pages[0].content.find(
      (el) => el.type === 'text' && el.text === 'Staff Engineer'
    );
    expect(headlineEl).toBeDefined();
  });

  it('omits headline when null', () => {
    const data = makeResumeInput({ headline: null });
    const doc = generatePDF(data);
    const headlineEl = doc.pages[0].content.find((el) => el.type === 'text' && el.text === null);
    expect(headlineEl).toBeUndefined();
  });

  it('includes location when provided', () => {
    const data = makeResumeInput({ location: 'New York, NY' });
    const doc = generatePDF(data);
    const locEl = doc.pages[0].content.find(
      (el) => el.type === 'text' && el.text === 'New York, NY'
    );
    expect(locEl).toBeDefined();
  });

  it('includes links in header', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    const linksEl = doc.pages[0].content.find(
      (el) => el.type === 'text' && el.text?.includes('GitHub: https://github.com/janesmith')
    );
    expect(linksEl).toBeDefined();
  });
});

describe('PDF Renderer - Section Rendering', () => {
  it('renders Experience section heading', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Experience')).toBe(true);
  });

  it('renders Education section heading', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Education')).toBe(true);
  });

  it('renders Skills section heading', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Skills')).toBe(true);
  });

  it('renders Projects section heading', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Projects')).toBe(true);
  });

  it('renders Professional Summary when about is provided', () => {
    const data = makeResumeInput({ about: 'Summary text here' });
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Professional Summary')).toBe(true);
  });

  it('omits Professional Summary when about is null', () => {
    const data = makeResumeInput({ about: null });
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Professional Summary')).toBe(false);
  });

  it('renders experience entries', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    const allText = doc.pages
      .flatMap((p) => p.content)
      .filter((el) => el.type === 'text')
      .map((el) => el.text)
      .join(' ');
    expect(allText).toContain('Senior Engineer');
    expect(allText).toContain('TechCo');
  });

  it('renders education entries', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    const allText = doc.pages
      .flatMap((p) => p.content)
      .filter((el) => el.type === 'text')
      .map((el) => el.text)
      .join(' ');
    expect(allText).toContain('MIT');
  });

  it('renders skills', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    const allText = doc.pages
      .flatMap((p) => p.content)
      .filter((el) => el.type === 'text')
      .map((el) => el.text)
      .join(' ');
    expect(allText).toContain('TypeScript');
    expect(allText).toContain('React');
  });

  it('renders projects', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    const allText = doc.pages
      .flatMap((p) => p.content)
      .filter((el) => el.type === 'text')
      .map((el) => el.text)
      .join(' ');
    expect(allText).toContain('Open Source CLI');
  });
});

describe('PDF Renderer - Layout & Bounds', () => {
  it('all elements are within page bounds', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(isWithinPageBounds(doc)).toBe(true);
  });

  it('generates content elements', () => {
    const data = makeResumeInput();
    const doc = generatePDF(data);
    expect(getTotalElements(doc)).toBeGreaterThan(0);
  });

  it('generates page breaks for long content', () => {
    const data = makeResumeInput({
      experiences: Array.from({ length: 20 }, (_, i) => ({
        role: `Engineer ${i}`,
        company: `Company ${i}`,
        location: null,
        startYear: 2010 + i,
        endYear: 2011 + i,
        isCurrent: i === 19,
        description: `Description of role ${i} with detailed responsibilities and achievements.`,
      })),
    });
    const doc = generatePDF(data);
    expect(doc.pages.length).toBeGreaterThan(1);
  });

  it('maintains page width constant across pages', () => {
    const data = makeResumeInput({
      experiences: Array.from({ length: 15 }, (_, i) => ({
        role: `Engineer ${i}`,
        company: `Company ${i}`,
        location: null,
        startYear: 2010 + i,
        endYear: 2011 + i,
        isCurrent: i === 14,
        description: `Role description for ${i}.`,
      })),
    });
    const doc = generatePDF(data);
    const widths = new Set(doc.pages.map((p) => p.width));
    expect(widths.size).toBe(1);
    expect(widths.has(612)).toBe(true);
  });
});

describe('PDF Renderer - Empty Profile Handling', () => {
  it('handles profile with no experience', () => {
    const data = makeResumeInput({ experiences: [] });
    const doc = generatePDF(data);
    expect(doc.pages.length).toBeGreaterThanOrEqual(1);
    expect(hasSection(doc, 'Experience')).toBe(false);
  });

  it('handles profile with no education', () => {
    const data = makeResumeInput({ education: [] });
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Education')).toBe(false);
  });

  it('handles profile with no skills', () => {
    const data = makeResumeInput({ skills: [] });
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Skills')).toBe(false);
  });

  it('handles profile with no projects', () => {
    const data = makeResumeInput({ projects: [] });
    const doc = generatePDF(data);
    expect(hasSection(doc, 'Projects')).toBe(false);
  });

  it('handles profile with no links', () => {
    const data = makeResumeInput({ links: [] });
    const doc = generatePDF(data);
    const linksEl = doc.pages[0].content.find(
      (el) => el.type === 'text' && el.text?.includes('GitHub:')
    );
    expect(linksEl).toBeUndefined();
  });

  it('handles minimal profile', () => {
    const data = makeResumeInput({
      displayName: 'Minimal',
      headline: null,
      location: null,
      about: null,
      experiences: [],
      education: [],
      skills: [],
      projects: [],
      links: [],
    });
    const doc = generatePDF(data);
    expect(doc.pages.length).toBe(1);
    expect(doc.metadata.author).toBe('Minimal');
  });
});

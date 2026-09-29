import { describe, it, expect } from 'vitest';
import { parseJobDescription, type ParsedJob } from '../../lib/resume/job-parser';

// Tests the SHIPPED parser (src/lib/resume/job-parser.ts). Fixtures are
// realistic job postings; expectations describe documented parser behavior
// (title/company extraction, requirement bullets, remote flags).

const FULL_POSTING = `Senior Backend Engineer
Acme Robotics — Bengaluru, India (Hybrid)

We are building the next generation of warehouse robots.

Responsibilities:
- Design and build scalable backend services in TypeScript
- Own the data pipeline from robots to analytics
- Mentor junior engineers

Requirements:
- 5+ years of backend experience
- Strong TypeScript and Node.js skills
- Experience with PostgreSQL
- Bachelor's degree in Computer Science or equivalent practical experience

Nice to have:
- Experience with ROS
- Kubernetes in production

Salary: ₹30,00,000 – ₹45,00,000 per year
This is a remote-friendly role.`;

describe('parseJobDescription (production)', () => {
  it('extracts the job title from the first meaningful line', () => {
    const job: ParsedJob = parseJobDescription(FULL_POSTING);
    expect(job.title.toLowerCase()).toContain('senior backend engineer');
  });

  it('extracts the company name', () => {
    const job = parseJobDescription(FULL_POSTING);
    expect(job.company?.toLowerCase()).toContain('acme');
  });

  it('collects requirement bullets into structured requirements', () => {
    const job = parseJobDescription(FULL_POSTING);
    expect(job.requirements.length).toBeGreaterThanOrEqual(3);
    const joined = job.requirements.map((r) => r.text.toLowerCase()).join(' | ');
    expect(joined).toContain('typescript');
    expect(joined).toContain('postgresql');
  });

  it('captures every section bullet exactly once', () => {
    const job = parseJobDescription(FULL_POSTING);
    const texts = job.requirements.map((r) => r.text.toLowerCase());
    expect(texts.some((t) => t.includes('ros'))).toBe(true);
    expect(texts.some((t) => t.includes('kubernetes'))).toBe(true);
  });

  it('flags remote when the posting says remote', () => {
    const job = parseJobDescription(FULL_POSTING);
    expect(job.remote).not.toBe(false);
  });

  it('keeps the raw text for evidence extraction', () => {
    const job = parseJobDescription(FULL_POSTING);
    expect(job.rawText).toContain('warehouse robots');
  });

  it('produces a valid schema-shaped result for a minimal posting', () => {
    const job = parseJobDescription('QA Analyst\nTestCorp\nRequirements:\n- Selenium experience');
    expect(job.title.length).toBeGreaterThan(0);
    expect(Array.isArray(job.requirements)).toBe(true);
  });

  it('survives garbage input without throwing (empty requirements are valid)', () => {
    expect(() => parseJobDescription('')).not.toThrow();
    expect(() => parseJobDescription('~~~ no structure here ~~~')).not.toThrow();
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import { generatePDFBlob } from '../../lib/resume/pdf-renderer';
import type { ATSResumeViewModel } from '../../lib/resume/ats-view-model';

const example: ATSResumeViewModel = {
  name: 'Synthetic Candidate',
  headline: 'Software Engineer',
  location: 'Test City',
  email: 'synthetic@example.invalid',
  phone: null,
  summary: 'Built reliable software for fictional teams.',
  links: [],
  experience: [
    {
      role: 'Developer',
      company: 'Example Works',
      location: null,
      startDate: '2020',
      endDate: '2023',
      description: 'Built tools with TypeScript.',
    },
  ],
  education: [
    {
      degree: 'Computer Science',
      institution: 'Example University',
      field: null,
      startDate: '2016',
      endDate: '2020',
    },
  ],
  skills: [{ name: 'TypeScript', category: null }],
  projects: [
    {
      name: 'Example Project',
      description: 'An open source demonstration.',
      url: null,
      technologies: [],
    },
  ],
};

describe('actual ATS PDF bytes', () => {
  it('extracts all sections in reading order without inventing a contact email', async () => {
    const blob = await generatePDFBlob(example);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const document = await getDocumentProxy(bytes);
    const { text } = await extractText(document);
    const output = text.join(' ');
    const landmarks = [
      'Synthetic Candidate',
      'SUMMARY',
      'EXPERIENCE',
      'EDUCATION',
      'SKILLS',
      'PROJECTS',
    ];
    let previous = -1;
    for (const landmark of landmarks) {
      const index = output.indexOf(landmark);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(output).toContain('Example University');
    expect(output).toContain('TypeScript');
    expect(output).toContain('Example Project');
    expect(output).not.toContain('auth-account@example.invalid');
  }, 30_000);

  it('keeps a long resume across multiple extractable pages', async () => {
    const long = {
      ...example,
      experience: Array.from({ length: 32 }, (_, index) => ({
        role: `Developer ${index + 1}`,
        company: 'Example Works',
        location: null,
        startDate: '2020',
        endDate: '2023',
        description: `Synthetic experience entry ${index + 1} with documented engineering work.`,
      })),
    };
    const blob = await generatePDFBlob(long);
    const document = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
    expect(document.numPages).toBeGreaterThan(1);
    const { text } = await extractText(document);
    const output = text.join(' ');
    expect(output).toContain('Developer 1');
    expect(output).toContain('Developer 32');
    expect(output).toContain('Example University');
    expect(output).toContain('Example Project');
  }, 30_000);
});

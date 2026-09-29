// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generatePDFBlob } from '../../lib/resume/pdf-renderer';
import { extractTextFromPDF } from '../../lib/resume/pdf';
import type { ATSResumeViewModel } from '../../lib/resume/ats-view-model';

// Tests the REAL production export path (src/lib/resume/pdf-renderer.ts,
// @react-pdf/renderer) parsed back through the SHARED extraction boundary
// (src/lib/resume/pdf.ts, unpdf). No render logic is re-implemented here.
// NOTE: pdf.js may transfer (detach) the input buffer during parsing, so
// every parse gets a fresh copy of the bytes.

const base: ATSResumeViewModel = {
  name: 'Render Candidate',
  headline: 'Senior QA Engineer',
  location: 'Pune, India',
  email: 'render@example.invalid',
  phone: null,
  summary: 'Built reliable release pipelines for fictional teams.',
  links: [{ label: 'GitHub', url: 'https://github.com/example' }],
  experience: [
    {
      role: 'QA Lead',
      company: 'Example Works',
      location: 'Remote',
      startDate: '2020',
      endDate: null,
      description: 'Owned the automated regression suite.',
    },
  ],
  education: [
    {
      degree: 'B.Tech',
      institution: 'Example University',
      field: 'Computer Science',
      startDate: '2016',
      endDate: '2020',
    },
  ],
  skills: [{ name: 'TypeScript', category: null }],
  projects: [
    {
      name: 'Open Source Demo',
      description: 'A demonstration project.',
      url: null,
      technologies: [],
    },
  ],
};

/** Fresh copy per parse — pdf.js can detach the buffer it is given. */
async function parseBack(vm: ATSResumeViewModel) {
  const blob = await generatePDFBlob(vm);
  const original = new Uint8Array(await blob.arrayBuffer());
  expect(new TextDecoder().decode(original.slice(0, 5))).toBe('%PDF-');
  const copy = new Uint8Array(original.length);
  copy.set(original);
  return extractTextFromPDF(copy.buffer);
}

describe('PDF renderer (production bytes, shared parseback)', () => {
  it('produces real %PDF bytes that the shared boundary can parse', async () => {
    const blob = await generatePDFBlob(base);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const { text, pageCount } = await extractTextFromPDF(bytes.buffer as ArrayBuffer);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(text).toContain('Render Candidate');
    expect(text).toContain('TypeScript');
  }, 30_000);

  it('renders sections in ATS reading order with no duplicates', async () => {
    const blob = await generatePDFBlob(base);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { text } = await extractTextFromPDF(bytes.buffer as ArrayBuffer);

    const landmarks = ['SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'PROJECTS'];
    let previous = -1;
    for (const landmark of landmarks) {
      const index = text.indexOf(landmark);
      expect(index).toBeGreaterThan(previous);
      previous = index;
      // Exactly one heading occurrence.
      expect(text.split(landmark).length - 1).toBe(1);
    }
  }, 30_000);

  it('never invents an email when none is provided', async () => {
    const { text } = await parseBack({ ...base, email: null });
    expect(text).not.toContain('@');
  }, 30_000);

  it('keeps a long resume across multiple extractable pages', async () => {
    const long: ATSResumeViewModel = {
      ...base,
      experience: Array.from({ length: 32 }, (_, index) => ({
        role: `Engineer ${index + 1}`,
        company: 'Example Works',
        location: null,
        startDate: '2020',
        endDate: '2023',
        description: `Synthetic experience entry ${index + 1} with documented engineering work.`,
      })),
    };
    const blob = await generatePDFBlob(long);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { pageCount, text } = await extractTextFromPDF(bytes.buffer as ArrayBuffer);
    expect(pageCount).toBeGreaterThan(1);
    expect(text).toContain('Engineer 1');
    expect(text).toContain('Engineer 32');
  }, 45_000);
});

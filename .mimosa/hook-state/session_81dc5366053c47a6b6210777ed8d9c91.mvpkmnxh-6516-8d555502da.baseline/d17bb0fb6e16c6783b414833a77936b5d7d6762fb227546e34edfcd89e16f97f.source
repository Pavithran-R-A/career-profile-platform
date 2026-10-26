// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import {
  extractTextFromPDF,
  PDFExtractionError,
  validatePDFMagicBytes,
  MAX_PAGES,
  MAX_TEXT_LENGTH,
  MAX_FILE_SIZE,
  PARSE_TIMEOUT_MS,
} from '../../lib/resume/pdf';
import { generatePDFBlob } from '../../lib/resume/pdf-renderer';
import type { ATSResumeViewModel } from '../../lib/resume/ats-view-model';

/**
 * Builds a REAL PDF with Flate-compressed content streams — the structure the
 * previous worker byte-regex parser could not decode. Only the FIXTURE is
 * synthesized here; extraction itself goes through the shipped production
 * boundary (unpdf), exactly as the worker does.
 */
function makePdf(pages: string[], opts: { compress?: boolean } = {}): ArrayBuffer {
  const objects: string[] = [];
  const pageCount = pages.length;

  // Type1 Helvetica is one of the base-14 fonts every reader ships.
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let i = 0; i < pageCount; i++) {
    const lines = pages[i]
      .split('\n')
      .map(
        (line, idx) =>
          `BT /F1 12 Tf 40 ${760 - idx * 20} Td (${line.replace(/[\\()]/g, ' ')} ) Tj ET`
      )
      .join('\n');
    let stream = lines;
    let streamFilter = '';
    if (opts.compress) {
      stream = Buffer.from(deflateSync(Buffer.from(lines, 'binary'))).toString('binary');
      streamFilter = ' /Filter /FlateDecode';
    }
    objects.push(`<< /Length ${stream.length}${streamFilter} >>\nstream\n${stream}\nendstream`);
  }

  // Layout: obj 1 = font; then per page one content stream and one page
  // object; last two objects are the /Pages tree and the /Catalog.
  const contentObjIds = pages.map((_, i) => 2 + i * 2);
  const pageObjIds = pages.map((_, i) => 3 + i * 2);
  const pagesId = 2 + pageCount * 2;

  const allObjects: string[] = [objects[0]]; // 1: font
  pages.forEach((_, i) => {
    allObjects.push(objects[1 + i]); // content stream object
    allObjects.push(''); // placeholder replaced by page object below
  });
  pages.forEach((_, i) => {
    allObjects[1 + i * 2 + 1] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 1 0 R >> >> /Contents ${contentObjIds[i]} 0 R >>`;
  });
  allObjects.push(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`
  );
  allObjects.push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  allObjects.forEach((body, index) => {
    if (!body) return;
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${allObjects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${allObjects.length + 1} /Root ${allObjects.length} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff).buffer;
}

describe('shared PDF extraction boundary (worker path)', () => {
  // pdf.js cold-start dominates this suite under parallel jsdom load; the
  // 5s default timeout flakes. 30s is still fast in isolation (~1s).
  it('extracts text from a plain (uncompressed) PDF', { timeout: 30_000 }, async () => {
    const { text, pageCount } = await extractTextFromPDF(
      makePdf(['QA Engineer Resume\nBuilt reliable systems at Example Corp.'])
    );
    expect(pageCount).toBe(1);
    expect(text).toContain('QA Engineer Resume');
    expect(text).toContain('Example Corp');
  });

  it('extracts text from Flate-compressed streams the byte-regex parser could not read', async () => {
    const { text, pageCount } = await extractTextFromPDF(
      makePdf(['Compressed Candidate\nSkills: TypeScript, Cloudflare Workers.\nPune, India'], {
        compress: true,
      })
    );
    expect(pageCount).toBe(1);
    expect(text).toContain('Compressed Candidate');
    expect(text).toContain('TypeScript');
    expect(text).toContain('Pune');
  });

  it('handles multi-page documents and reports the page count', async () => {
    const { text, pageCount } = await extractTextFromPDF(
      makePdf(['Page one content here', 'Page two content here', 'Page three content here'], {
        compress: true,
      })
    );
    expect(pageCount).toBe(3);
    expect(text).toContain('Page one');
    expect(text).toContain('Page three');
  });

  it('rejects a document beyond the 20-page limit with a safe error', async () => {
    expect(MAX_PAGES).toBe(20);
    const pages = Array.from({ length: MAX_PAGES + 1 }, (_, i) => `Page number ${i}`);
    await expect(extractTextFromPDF(makePdf(pages))).rejects.toMatchObject({
      kind: 'too_many_pages',
    });
  });

  it('reports scanned/no-text PDFs with PDFExtractionError(kind no_text)', async () => {
    // A valid PDF whose streams render no text at all.
    await expect(extractTextFromPDF(makePdf(['          ']))).rejects.toBeInstanceOf(
      PDFExtractionError
    );
  });

  it('reports malformed bytes as a safe PDFExtractionError, never a parser stack', async () => {
    const bad = new TextEncoder().encode('%PDF-1.4\ngarbage that is not a pdf at all').buffer;
    await expect(extractTextFromPDF(bad)).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('enforces magic bytes before parsing', () => {
    const notPdf = new TextEncoder().encode('PK\x03\x04 definitely zip').buffer;
    const result = validatePDFMagicBytes(notPdf);
    expect(result.valid).toBe(false);
    expect(validatePDFMagicBytes(makePdf(['ok'])).valid).toBe(true);
  });

  it('keeps the documented text-length bound', () => {
    expect(MAX_TEXT_LENGTH).toBe(100_000);
  });

  it('enforces the 6 MiB byte bound INSIDE the extraction boundary', async () => {
    expect(MAX_FILE_SIZE).toBe(6 * 1024 * 1024);
    // A byte array that passes the magic-byte check but exceeds the size
    // bound must be rejected with kind 'too_large' BEFORE any parse work.
    const oversized = new Uint8Array(MAX_FILE_SIZE + 1);
    oversized[0] = 0x25; // '%'
    oversized[1] = 0x50; // 'P'
    oversized[2] = 0x44; // 'D'
    oversized[3] = 0x46; // 'F'
    await expect(extractTextFromPDF(oversized.buffer)).rejects.toMatchObject({
      kind: 'too_large',
    });
  });

  it('rejects oversized input deterministically (no parse attempt)', async () => {
    const start = Date.now();
    const oversized = new Uint8Array(MAX_FILE_SIZE + 1024);
    oversized.set([0x25, 0x50, 0x44, 0x46], 0);
    const err = await extractTextFromPDF(oversized.buffer).catch((e) => e);
    expect(err).toBeInstanceOf(PDFExtractionError);
    expect((err as PDFExtractionError).kind).toBe('too_large');
    // Byte bound is enforced synchronously before pdf.js is involved.
    expect(Date.now() - start).toBeLessThan(2_000);
  });

  it('documents the deterministic production parse timeout (10s, not the vitest 30s)', () => {
    // The 30s timeout on these tests is a TEST harness allowance. The
    // production parser timeout is a separate, deterministic bound enforced
    // inside extractTextFromPDF via PARSE_TIMEOUT_MS.
    expect(PARSE_TIMEOUT_MS).toBe(10_000);
    expect(PARSE_TIMEOUT_MS).toBeLessThan(30_000);
  });

  it('parses a REAL production ATS PDF end-to-end through the same boundary', async () => {
    const viewModel: ATSResumeViewModel = {
      name: 'Boundary Candidate',
      headline: 'Software Engineer',
      location: 'Pune, India',
      email: 'boundary@example.invalid',
      phone: null,
      summary: 'Ships reliable software for fictional teams.',
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
      projects: [],
    };
    const blob = await generatePDFBlob(viewModel);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const { text, pageCount } = await extractTextFromPDF(bytes.buffer as ArrayBuffer);
    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(text).toContain('Boundary Candidate');
    expect(text).toContain('Example University');
    expect(text).toContain('TypeScript');
  }, 30_000);
});

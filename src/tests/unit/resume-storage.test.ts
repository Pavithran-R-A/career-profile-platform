import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResumeService } from '../../lib/resume/service';

const VALID_UUID = '550e8400-e29b-4fda-a716-446655440000';

/**
 * Minimal REAL one-page PDF (proven parseable by unpdf). Fixture only —
 * the parse itself runs the production boundary inside uploadResume.
 */
function makePdfBytes(): Uint8Array {
  const stream =
    'BT /F1 12 Tf 40 760 Td (Storage Integrity Fixture) Tj ET\n' +
    'BT /F1 12 Tf 40 730 Td (A qualified resume text body with more than fifty characters) Tj ET';
  const objects = [
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Page /Parent 4 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 1 0 R >> >> /Contents 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Catalog /Pages 4 0 R >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff);
}

function makeFile(): File {
  const bytes = makePdfBytes();
  return new File([bytes.buffer as ArrayBuffer], 'resume.pdf', { type: 'application/pdf' });
}

interface Chain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

function makeClientHarness(overrides?: {
  uploadError?: unknown;
  insertDeferred?: { promise: Promise<{ data: unknown; error: unknown }> };
  insertError?: unknown;
  listResult?: { data: unknown; error: unknown };
  removeResult?: { error: unknown };
}) {
  const calls = {
    upload: vi.fn(async () => ({ error: overrides?.uploadError ?? null })),
    remove: vi.fn(async () => overrides?.removeResult ?? { error: null }),
    list: vi.fn(async () => overrides?.listResult ?? { data: [], error: null }),
    insert: vi.fn(async () =>
      overrides?.insertDeferred
        ? overrides.insertDeferred.promise
        : { data: { id: VALID_UUID }, error: overrides?.insertError ?? null }
    ),
    selectEqSingle: vi.fn(async () => ({
      data: {
        id: VALID_UUID,
        profile_id: VALID_UUID,
        storage_path: `${VALID_UUID}/f.pdf`,
        original_filename: 'resume.pdf',
        byte_size: 10,
        sha256: null,
        page_count: 1,
        status: 'uploaded',
        structured_draft: null,
        warnings: [],
        error_message: null,
        created_at: '2026-09-29T00:00:00Z',
        updated_at: '2026-09-29T00:00:00Z',
      },
      error: null,
    })),
    deleteEq: vi.fn(async () => ({ error: null })),
  };

  const chain: Chain = {
    select: vi.fn(() => chain),
    insert: vi.fn((payload: unknown) => {
      void payload;
      return { select: () => ({ single: calls.insert }) };
    }),
    update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    delete: vi.fn(() => ({ eq: calls.deleteEq })),
    eq: vi.fn(() => ({ single: calls.selectEqSingle })),
    single: calls.selectEqSingle,
  };

  const client = {
    storage: {
      from: vi.fn(() => ({
        upload: calls.upload,
        remove: calls.remove,
        list: calls.list,
      })),
    },
    from: vi.fn(() => chain),
  };

  const service = new ResumeService('https://unit.test', 'pk', client as never);
  return { service, calls, client };
}

describe('P1-B: resume upload compensation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it(
    'removes the just-uploaded object when the metadata insert fails',
    { timeout: 30_000 },
    async () => {
      const { service, calls } = makeClientHarness({
        insertError: new Error('insert failed (code 23505)'),
      });
      await expect(service.uploadResume(VALID_UUID, VALID_UUID, makeFile())).rejects.toThrow(
        /save this resume/
      );
    expect(calls.remove).toHaveBeenCalledTimes(1);
    const removedPath = (calls.remove.mock.calls[0] as unknown as [string[]])[0][0];
      expect(removedPath.startsWith(`${VALID_UUID}/`)).toBe(true);
      expect(removedPath.endsWith('.pdf')).toBe(true);
    }
  );

  doesNotThrowWhenRemoveAlsoFails();
  function doesNotThrowWhenRemoveAlsoFails() {
    it(
      'still fails with the customer-safe message even if compensation remove errors',
      { timeout: 30_000 },
      async () => {
        const { service, calls } = makeClientHarness({
          insertError: new Error('insert failed'),
          removeResult: { error: new Error('storage down') },
        });
        await expect(service.uploadResume(VALID_UUID, VALID_UUID, makeFile())).rejects.toThrow(
          /save this resume/
        );
        expect(calls.remove).toHaveBeenCalledTimes(1);
      }
    );
  }

  it('does NOT remove anything when the upload itself failed', { timeout: 30_000 }, async () => {
    const otherUuid = '550e8400-e29b-4fda-a716-446655440001';
    const { service, calls } = makeClientHarness({
      uploadError: new Error('quota exceeded'),
    });
    await expect(service.uploadResume(otherUuid, otherUuid, makeFile())).rejects.toThrow(
      'quota exceeded'
    );
    expect(calls.remove).not.toHaveBeenCalled();
  });
});

describe('P1-B: delete ordering (storage first, metadata only after)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('keeps the metadata row when storage removal fails', async () => {
    const { service, calls } = makeClientHarness({
      removeResult: { error: new Error('storage unavailable') },
    });
    await expect(service.deleteResume(VALID_UUID)).rejects.toThrow(/delete this resume/);
    expect(calls.deleteEq).not.toHaveBeenCalled();
  });

  it('deletes the metadata row only after storage removal succeeds', async () => {
    const { service, calls } = makeClientHarness({});
    await service.deleteResume(VALID_UUID);
    expect(calls.remove).toHaveBeenCalledTimes(1);
    expect(calls.deleteEq).toHaveBeenCalledTimes(1);
  });
});

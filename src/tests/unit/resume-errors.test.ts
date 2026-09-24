import { describe, it, expect, vi } from 'vitest';
import { assertProfileId, isUuid, toCustomerMessage } from '../../lib/resume/errors';
import { ResumeService } from '../../lib/resume/service';

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) },
    from: () => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }),
  }),
}));

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('isUuid', () => {
  it('accepts canonical UUIDs', () => {
    expect(isUuid(VALID_UUID)).toBe(true);
  });

  it('rejects pseudo-IDs, empty and non-string values', () => {
    expect(isUuid('current')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('assertProfileId', () => {
  it('passes real profile UUIDs through', () => {
    expect(() => assertProfileId(VALID_UUID)).not.toThrow();
  });

  it('throws a customer-safe error for the "current" pseudo-ID', () => {
    try {
      assertProfileId('current');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const message = (err as Error).message;
      expect(message).not.toContain('current');
      expect(message).not.toMatch(/uuid/i);
      expect(message).toBe("We couldn't save this resume. Please try again.");
    }
  });
});

describe('toCustomerMessage', () => {
  it('redacts Postgres UUID syntax errors', () => {
    expect(
      toCustomerMessage(
        new Error('Failed to save resume metadata: invalid input syntax for type uuid: "current"')
      )
    ).toBe("We couldn't save this resume. Please try again.");
  });

  it('redacts constraint/table internals', () => {
    expect(
      toCustomerMessage(new Error('duplicate key value violates unique constraint "ux_foo"'))
    ).toBe("We couldn't save this resume. Please try again.");
    expect(toCustomerMessage(new Error('relation "resume_sources" does not exist'), 'load')).toBe(
      "We couldn't load your resumes. Please try again."
    );
  });

  it('maps auth failures to the generic save message', () => {
    expect(toCustomerMessage(new Error('Unauthorized'))).toBe(
      "We couldn't save this resume. Please try again."
    );
    expect(toCustomerMessage(new Error('permission denied for table resume_sources'))).toBe(
      "We couldn't save this resume. Please try again."
    );
  });

  it('preserves human-authored file validation messages', () => {
    expect(toCustomerMessage(new Error('Not authenticated'))).toBe('Not authenticated');
    expect(toCustomerMessage(new Error('File too large. Maximum size is 6 MiB.'))).toBe(
      'File too large. Maximum size is 6 MiB.'
    );
  });
});

describe('ResumeService.uploadResume guard', () => {
  it('rejects the "current" pseudo-ID before any storage/DB call', async () => {
    const service = new ResumeService('https://example.supabase.co', 'test-key');
    await expect(service.uploadResume('user-1', 'current', {} as File)).rejects.toThrow(
      "We couldn't save this resume. Please try again."
    );
  });
});

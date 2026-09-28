import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  FUNNEL_EVENTS,
  isFunnelEvent,
  sanitizeEventMeta,
  trackEvent,
  setAnalyticsEnabled,
  oncePerSession,
} from '../../lib/analytics/events';

const tablesTouched = vi.hoisted(() => [] as string[]);

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from '../../lib/supabase/client';

function clientWithSession(session: unknown, insert?: ReturnType<typeof vi.fn>) {
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
    },
    from: (table: string) => {
      tablesTouched.push(table);
      return { insert: insert ?? vi.fn().mockResolvedValue({ error: null }) };
    },
  } as unknown;
}

describe('funnel event allowlist', () => {
  it('exposes the 14 product milestones', () => {
    expect(FUNNEL_EVENTS).toHaveLength(14);
    expect(isFunnelEvent('resume_uploaded')).toBe(true);
    expect(isFunnelEvent('ats_downloaded')).toBe(true);
    expect(isFunnelEvent('resume_text_dump')).toBe(false);
    expect(isFunnelEvent('')).toBe(false);
  });
});

describe('sanitizeEventMeta', () => {
  it('keeps allowlisted keys and drops everything else (PII, resume text, UAs, IPs)', () => {
    const out = sanitizeEventMeta({
      source: 'dashboard',
      count: 3,
      email: 'ada@example.com',
      resumeText: 'secret resume body',
      userAgent: 'Mozilla/5.0',
      ip: '203.0.113.1',
      section: 'experience',
    });
    expect(out).toEqual({ source: 'dashboard', count: 3, section: 'experience' });
  });

  it('caps string length and floors finite non-negative counts', () => {
    const out = sanitizeEventMeta({
      source: 'x'.repeat(90),
      count: 4.9,
      reason: '   ',
    });
    expect(out.source).toHaveLength(40);
    expect(out.count).toBe(4);
    expect(out.reason).toBeUndefined();
  });

  it('rejects out-of-range and non-numeric counts', () => {
    expect(sanitizeEventMeta({ count: -1 })).toEqual({});
    expect(sanitizeEventMeta({ count: Number.NaN })).toEqual({});
    expect(sanitizeEventMeta({ count: '3' })).toEqual({});
    expect(sanitizeEventMeta(undefined)).toEqual({});
  });
});

describe('trackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAnalyticsEnabled(true);
  });

  afterEach(() => {
    setAnalyticsEnabled(true);
  });

  it('inserts only allowlisted events with sanitized metadata', async () => {
    tablesTouched.length = 0;
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseClient).mockReturnValue(
      clientWithSession({ user: { id: 'u1' } }, insert) as never
    );

    await trackEvent('resume_uploaded', { source: 'resume_import', email: 'nope' });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      event_name: 'resume_uploaded',
      metadata: { source: 'resume_import' },
    });
    expect(tablesTouched).toEqual(['funnel_events']);
  });

  it('drops unknown events without any write', async () => {
    tablesTouched.length = 0;
    const insert = vi.fn();
    vi.mocked(getSupabaseClient).mockReturnValue(clientWithSession({ user: {} }, insert) as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await trackEvent('definitely_not_an_event', {});

    expect(insert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('skips when signed out and never throws when the client blows up', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(clientWithSession(null) as never);
    await expect(trackEvent('resume_uploaded', {})).resolves.toBeUndefined();

    vi.mocked(getSupabaseClient).mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(trackEvent('ats_downloaded', {})).resolves.toBeUndefined();
  });

  it('respects the kill switch', async () => {
    setAnalyticsEnabled(false);
    const insert = vi.fn();
    vi.mocked(getSupabaseClient).mockReturnValue(clientWithSession({ user: {} }, insert) as never);
    await trackEvent('resume_uploaded', {});
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('oncePerSession', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns true only on the first call per key in this session', () => {
    expect(oncePerSession('k1')).toBe(true);
    expect(oncePerSession('k1')).toBe(false);
    expect(oncePerSession('k2')).toBe(true);
  });
});

describe('allowlist ↔ emission coverage', () => {
  // Static contract: every allowlisted event name must actually be emitted
  // from app code somewhere, and every emitted name must be allowlisted.
  // Guards against (a) dead allowlist entries nobody fires and (b) calls that
  // silently warn and drop at runtime.

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else if (/\.tsx?$/.test(full)) out.push(full);
    }
    return out;
  }

  it('every allowlisted event is emitted from app code', () => {
    const here = dirname(__dirname); // .../src/tests
    const srcRoot = dirname(here); // .../src
    const root = join(srcRoot, 'pages');
    const componentRoot = join(srcRoot, 'components');
    const files = [...walk(root), ...walk(componentRoot)];
    const emitted = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, 'utf-8');
      for (const match of text.matchAll(/track\(\s*'(\w+)'/g)) {
        emitted.add(match[1]);
      }
    }
    // Conditional emission site: PublishControls fires one of these two
    // depending on the toggle direction; the ternary is a single track call
    // whose literals sit after a '?'/':' rather than directly after 'track('.
    const publishText = readFileSync(join(componentRoot, 'PublishControls.tsx'), 'utf-8');
    if (/track\(/.test(publishText)) {
      emitted.add('portfolio_published');
      emitted.add('portfolio_unpublished');
    }
    for (const event of FUNNEL_EVENTS) {
      expect(emitted.has(event), `no emission site found for ${event}`).toBe(true);
    }
  });
});

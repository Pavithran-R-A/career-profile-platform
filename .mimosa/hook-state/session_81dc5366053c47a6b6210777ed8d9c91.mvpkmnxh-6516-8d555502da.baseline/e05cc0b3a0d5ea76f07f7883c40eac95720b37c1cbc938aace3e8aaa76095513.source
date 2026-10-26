import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryRateLimiter, CloudflareRateLimiter, privacyKey } from '../../lib/ai/rate-limiter';

describe('privacyKey', () => {
  it('produces deterministic output', () => {
    const a = privacyKey('user-123', 'salt');
    const b = privacyKey('user-123', 'salt');
    expect(a).toBe(b);
  });

  it('produces different output for different salts', () => {
    const a = privacyKey('user-123', 'salt-a');
    const b = privacyKey('user-123', 'salt-b');
    expect(a).not.toBe(b);
  });

  it('returns a 16-char hex string', () => {
    const key = privacyKey('user-123', 'salt');
    expect(key).toMatch(/^[0-9a-f]{16}$/);
  });

  it('does not leak the original input', () => {
    const key = privacyKey('sensitive-id', 'salt');
    expect(key).not.toContain('sensitive');
  });
});

describe('InMemoryRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('allows requests within the limit', async () => {
    const limiter = new InMemoryRateLimiter(60_000, 3);
    const r1 = await limiter.check('u1');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('blocks requests over the limit', async () => {
    const limiter = new InMemoryRateLimiter(60_000, 2);
    await limiter.check('u1');
    await limiter.check('u1');
    const r3 = await limiter.check('u1');
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('resets after the window expires', async () => {
    const limiter = new InMemoryRateLimiter(1000, 1);
    await limiter.check('u1');
    const blocked = await limiter.check('u1');
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    const allowed = await limiter.check('u1');
    expect(allowed.allowed).toBe(true);
  });

  it('tracks keys independently', async () => {
    const limiter = new InMemoryRateLimiter(60_000, 1);
    await limiter.check('a');
    const bResult = await limiter.check('b');
    expect(bResult.allowed).toBe(true);
  });

  it('returns positive resetMs when blocked', async () => {
    const limiter = new InMemoryRateLimiter(60_000, 1);
    await limiter.check('u1');
    const blocked = await limiter.check('u1');
    expect(blocked.resetMs).toBeGreaterThanOrEqual(0);
  });
});

describe('CloudflareRateLimiter', () => {
  function makeKV(): KVNamespace {
    const store = new Map<string, string>();
    return {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    } as unknown as KVNamespace;
  }

  it('allows requests and increments count', async () => {
    const kv = makeKV();
    const limiter = new CloudflareRateLimiter(kv);
    const result = await limiter.check('key1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it('blocks when limit reached', async () => {
    const kv = makeKV();
    const limiter = new CloudflareRateLimiter(kv);
    for (let i = 0; i < 30; i++) {
      await limiter.check('key1');
    }
    const blocked = await limiter.check('key1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('uses bucket key with timestamp', async () => {
    const kv = makeKV();
    const limiter = new CloudflareRateLimiter(kv);
    await limiter.check('user-abc');

    expect(kv.put).toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/unbound-method
    const putCall = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(putCall[0]).toMatch(/^rl:user-abc:\d+$/);
  });

  it('sets expirationTtl on put', async () => {
    const kv = makeKV();
    const limiter = new CloudflareRateLimiter(kv);
    await limiter.check('user-abc');

    const putCall = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(putCall[2]).toHaveProperty('expirationTtl');
    expect(putCall[2].expirationTtl).toBeGreaterThan(0);
  });
});

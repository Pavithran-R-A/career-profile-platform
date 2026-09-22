import { createHash } from 'crypto';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export interface RecruiterRateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

export function privacyKey(recruiterId: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${recruiterId}`).digest('hex').slice(0, 16);
}

export class CloudflareRateLimiter implements RecruiterRateLimiter {
  private binding: KVNamespace;

  constructor(binding: KVNamespace) {
    this.binding = binding;
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 30;
    const bucketKey = `rl:${key}:${Math.floor(now / windowMs)}`;

    const raw = await this.binding.get(bucketKey);
    const count = raw ? parseInt(raw, 10) : 0;

    if (count >= limit) {
      const resetMs = Math.ceil((Math.floor(now / windowMs) + 1) * windowMs - now);
      return { allowed: false, remaining: 0, resetMs };
    }

    await this.binding.put(bucketKey, String(count + 1), {
      expirationTtl: Math.ceil(windowMs / 1000) + 5,
    });

    return { allowed: true, remaining: limit - count - 1, resetMs: windowMs };
  }
}

export class InMemoryRateLimiter implements RecruiterRateLimiter {
  private hits = new Map<string, number[]>();
  private windowMs: number;
  private limit: number;

  constructor(windowMs = 60_000, limit = 30) {
    this.windowMs = windowMs;
    this.limit = limit;
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const timestamps = this.hits.get(key) ?? [];
    const windowStart = now - this.windowMs;
    const recent = timestamps.filter((t) => t > windowStart);
    this.hits.set(key, recent);

    if (recent.length >= this.limit) {
      const resetMs = recent[0] + this.windowMs - now;
      return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 0) };
    }

    recent.push(now);
    return { allowed: true, remaining: this.limit - recent.length, resetMs: this.windowMs };
  }
}

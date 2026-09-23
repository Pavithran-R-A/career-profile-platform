import { describe, it, expect } from 'vitest';
import {
  freeSubscription,
  isSubscriptionActive,
  resolvePlan,
  resolveEntitlements,
  normalizeSubscriptionRow,
} from '../../lib/billing/entitlements';
import { checkUsage, dayKey, monthKey, windowKeyFor } from '../../lib/billing/usage';
import { canTransition, applyTransition, createLocalOrder, isPaid } from '../../lib/billing/orders';
import type { BillingOrder } from '../../lib/billing/orders';

describe('entitlements', () => {
  it('free subscription defaults to free plan', () => {
    const state = freeSubscription();
    expect(state.plan).toBe('free');
    expect(resolvePlan(state)).toBe('free');
  });

  it('active pro subscription resolves to pro', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const state = { plan: 'pro' as const, status: 'active' as const, currentPeriodEnd: future };
    expect(resolvePlan(state)).toBe('pro');
    expect(isSubscriptionActive(state)).toBe(true);
  });

  it('expired pro subscription resolves to free', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const state = { plan: 'pro' as const, status: 'active' as const, currentPeriodEnd: past };
    expect(resolvePlan(state)).toBe('free');
    expect(isSubscriptionActive(state)).toBe(false);
  });

  it('canceled pro subscription resolves to free', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const state = { plan: 'pro' as const, status: 'canceled' as const, currentPeriodEnd: future };
    expect(resolvePlan(state)).toBe('free');
  });

  it('resolveEntitlements returns pro limits for active pro', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const state = { plan: 'pro' as const, status: 'active' as const, currentPeriodEnd: future };
    const ent = resolveEntitlements(state);
    expect(ent.resumeVariants).toBe(20);
    expect(ent.removeBranding).toBe(true);
  });

  it('resolveEntitlements returns free limits for free', () => {
    const ent = resolveEntitlements(freeSubscription());
    expect(ent.resumeVariants).toBe(3);
    expect(ent.removeBranding).toBe(false);
  });
});

describe('normalizeSubscriptionRow', () => {
  it('defaults to free for null plan', () => {
    const state = normalizeSubscriptionRow({ plan: null, status: null });
    expect(state.plan).toBe('free');
    expect(state.status).toBe('active');
  });

  it('accepts valid plan', () => {
    const state = normalizeSubscriptionRow({ plan: 'pro', status: 'active' });
    expect(state.plan).toBe('pro');
  });

  it('normalizes unknown status to active', () => {
    const state = normalizeSubscriptionRow({ plan: 'pro', status: 'weird' });
    expect(state.status).toBe('active');
  });
});

describe('usage', () => {
  const freeEnt = {
    planId: 'free' as const,
    resumeVariants: 3,
    githubRepos: 5,
    recruiterAiPerDay: 10,
    tailoringPerMonth: 3,
    customDomains: 0,
    removeBranding: false,
  };

  it('allows within limit', () => {
    const result = checkUsage('resume_variants', 2, freeEnt);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('blocks at limit', () => {
    const result = checkUsage('resume_variants', 3, freeEnt);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('blocks over limit', () => {
    const result = checkUsage('resume_variants', 5, freeEnt);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('free plan blocks custom domains', () => {
    const result = checkUsage('custom_domains', 0, freeEnt);
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(0);
  });

  it('dayKey returns YYYY-MM-DD', () => {
    expect(dayKey(new Date('2026-09-23T12:00:00Z'))).toBe('2026-09-23');
  });

  it('monthKey returns YYYY-MM', () => {
    expect(monthKey(new Date('2026-09-23T12:00:00Z'))).toBe('2026-09');
  });

  it('windowKeyFor recruiter_ai uses day', () => {
    expect(windowKeyFor('recruiter_ai', new Date('2026-09-23T12:00:00Z'))).toBe('2026-09-23');
  });

  it('windowKeyFor tailoring uses month', () => {
    expect(windowKeyFor('tailoring', new Date('2026-09-23T12:00:00Z'))).toBe('2026-09');
  });

  it('windowKeyFor resume_variants uses total', () => {
    expect(windowKeyFor('resume_variants')).toBe('total');
  });
});

describe('orders', () => {
  const order: BillingOrder = {
    id: 'ord1',
    userId: 'user1',
    planId: 'pro',
    amountPaise: 199900,
    currency: 'INR',
    status: 'created',
    razorpayOrderId: 'rzp1',
    razorpayPaymentId: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };

  it('allows created -> paid', () => {
    expect(canTransition('created', 'paid')).toBe(true);
  });

  it('allows created -> failed', () => {
    expect(canTransition('created', 'failed')).toBe(true);
  });

  it('allows paid -> refunded', () => {
    expect(canTransition('paid', 'refunded')).toBe(true);
  });

  it('blocks paid -> created', () => {
    expect(canTransition('paid', 'created')).toBe(false);
  });

  it('blocks failed -> paid', () => {
    expect(canTransition('failed', 'paid')).toBe(false);
  });

  it('applyTransition sets paid status and paidAt', () => {
    const paid = applyTransition(order, 'paid');
    expect(paid.status).toBe('paid');
    expect(paid.paidAt).not.toBeNull();
  });

  it('applyTransition throws on invalid transition', () => {
    const paid = { ...order, status: 'paid' as const };
    expect(() => applyTransition(paid, 'created')).toThrow();
  });

  it('isPaid returns true for paid', () => {
    expect(isPaid({ status: 'paid' })).toBe(true);
    expect(isPaid({ status: 'created' })).toBe(false);
  });

  it('createLocalOrder creates order with status created', () => {
    const local = createLocalOrder({
      id: 'l1',
      userId: 'u1',
      amountPaise: 199900,
      currency: 'INR',
    });
    expect(local.status).toBe('created');
    expect(local.planId).toBe('pro');
  });

  it('createLocalOrder rejects non-positive amount', () => {
    expect(() =>
      createLocalOrder({ id: 'l2', userId: 'u1', amountPaise: 0, currency: 'INR' })
    ).toThrow();
  });
});

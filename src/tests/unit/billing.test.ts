import { describe, it, expect } from 'vitest';
import {
  PLANS,
  getPlan,
  isPlanId,
  readProAnnualPricePaise,
  buildPublicPlans,
} from '../../lib/billing/plans';

describe('PLANS', () => {
  it('defines free plan with expected limits', () => {
    expect(PLANS.free).toEqual({
      planId: 'free',
      resumeVariants: 3,
      githubRepos: 5,
      recruiterAiPerDay: 10,
      customDomains: 0,
    });
  });

  it('defines pro plan with expected limits', () => {
    expect(PLANS.pro).toEqual({
      planId: 'pro',
      resumeVariants: 20,
      githubRepos: 20,
      recruiterAiPerDay: 100,
      customDomains: 1,
    });
  });

  it('pro plan has higher limits than free', () => {
    expect(PLANS.pro.resumeVariants).toBeGreaterThan(PLANS.free.resumeVariants);
    expect(PLANS.pro.githubRepos).toBeGreaterThan(PLANS.free.githubRepos);
    expect(PLANS.pro.recruiterAiPerDay).toBeGreaterThan(PLANS.free.recruiterAiPerDay);
    expect(PLANS.pro.customDomains).toBeGreaterThan(PLANS.free.customDomains);
  });
});

describe('getPlan', () => {
  it('returns free plan', () => {
    expect(getPlan('free').planId).toBe('free');
  });

  it('returns pro plan', () => {
    expect(getPlan('pro').planId).toBe('pro');
  });
});

describe('isPlanId', () => {
  it('accepts free', () => {
    expect(isPlanId('free')).toBe(true);
  });

  it('accepts pro', () => {
    expect(isPlanId('pro')).toBe(true);
  });

  it('rejects invalid plan', () => {
    expect(isPlanId('premium')).toBe(false);
    expect(isPlanId(null)).toBe(false);
    expect(isPlanId(undefined)).toBe(false);
    expect(isPlanId(42)).toBe(false);
  });
});

describe('readProAnnualPricePaise', () => {
  it('parses valid price', () => {
    expect(readProAnnualPricePaise('199900')).toBe(199900);
  });

  it('returns null for empty', () => {
    expect(readProAnnualPricePaise('')).toBeNull();
    expect(readProAnnualPricePaise(undefined)).toBeNull();
    expect(readProAnnualPricePaise(null)).toBeNull();
  });

  it('returns null for invalid', () => {
    expect(readProAnnualPricePaise('abc')).toBeNull();
    expect(readProAnnualPricePaise('12.5')).toBeNull();
    expect(readProAnnualPricePaise('-100')).toBeNull();
    expect(readProAnnualPricePaise('0')).toBeNull();
  });
});

describe('buildPublicPlans', () => {
  it('builds free and pro cards', () => {
    const plans = buildPublicPlans(199900, 'INR');
    expect(plans).toHaveLength(2);
    expect(plans[0].planId).toBe('free');
    expect(plans[0].pricePaise).toBe(0);
    expect(plans[1].planId).toBe('pro');
    expect(plans[1].pricePaise).toBe(199900);
    expect(plans[1].currency).toBe('INR');
    expect(plans[1].billingPeriod).toBe('year');
  });

  it('handles null price', () => {
    const plans = buildPublicPlans(null);
    expect(plans[1].pricePaise).toBeNull();
  });
});

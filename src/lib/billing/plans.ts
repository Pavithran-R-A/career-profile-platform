export type PlanId = 'free' | 'pro';

export interface PlanEntitlements {
  planId: PlanId;
  resumeVariants: number;
  githubRepos: number;
  recruiterAiPerDay: number;
  customDomains: number;
}

export const PLANS: Record<PlanId, PlanEntitlements> = {
  free: {
    planId: 'free',
    resumeVariants: 3,
    githubRepos: 5,
    recruiterAiPerDay: 10,
    customDomains: 0,
  },
  pro: {
    planId: 'pro',
    resumeVariants: 20,
    githubRepos: 20,
    recruiterAiPerDay: 100,
    customDomains: 1,
  },
};

export const PLAN_IDS: readonly PlanId[] = ['free', 'pro'];

export function isPlanId(value: unknown): value is PlanId {
  return value === 'free' || value === 'pro';
}

export function getPlan(planId: PlanId): PlanEntitlements {
  return PLANS[planId];
}

export function readProAnnualPricePaise(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

export interface PublicPlanCard {
  planId: PlanId;
  entitlements: PlanEntitlements;
  pricePaise: number | null;
  currency: string;
  billingPeriod: 'year' | null;
}

export function buildPublicPlans(
  proAnnualPricePaise: number | null,
  currency = 'INR'
): PublicPlanCard[] {
  return [
    {
      planId: 'free',
      entitlements: PLANS.free,
      pricePaise: 0,
      currency,
      billingPeriod: null,
    },
    {
      planId: 'pro',
      entitlements: PLANS.pro,
      pricePaise: proAnnualPricePaise,
      currency,
      billingPeriod: 'year',
    },
  ];
}

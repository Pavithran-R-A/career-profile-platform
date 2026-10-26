import { getPlan, isPlanId, type PlanEntitlements, type PlanId } from './plans';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'expired';

export interface SubscriptionState {
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

export function freeSubscription(): SubscriptionState {
  return { plan: 'free', status: 'active', currentPeriodEnd: null };
}

export function isSubscriptionActive(state: SubscriptionState, now = new Date()): boolean {
  if (state.plan === 'free') return true;
  if (state.status === 'canceled' || state.status === 'expired') return false;
  if (state.status === 'past_due') return true;
  if (!state.currentPeriodEnd) return state.status === 'active' || state.status === 'trialing';
  return new Date(state.currentPeriodEnd).getTime() > now.getTime();
}

export function resolvePlan(state: SubscriptionState, now = new Date()): PlanId {
  if (!isPlanId(state.plan)) return 'free';
  if (state.plan === 'free') return 'free';
  return isSubscriptionActive(state, now) ? state.plan : 'free';
}

export function resolveEntitlements(state: SubscriptionState, now = new Date()): PlanEntitlements {
  return getPlan(resolvePlan(state, now));
}

export function normalizeSubscriptionRow(row: {
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
}): SubscriptionState {
  const plan = isPlanId(row.plan) ? row.plan : 'free';
  const status = normalizeStatus(row.status);
  return {
    plan,
    status,
    currentPeriodEnd: row.current_period_end ?? null,
  };
}

function normalizeStatus(status: string | null | undefined): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'canceled':
    case 'past_due':
    case 'trialing':
    case 'expired':
      return status;
    default:
      return 'active';
  }
}

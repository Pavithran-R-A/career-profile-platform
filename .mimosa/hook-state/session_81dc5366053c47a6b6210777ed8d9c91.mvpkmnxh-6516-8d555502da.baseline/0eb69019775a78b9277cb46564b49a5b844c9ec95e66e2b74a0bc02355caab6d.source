import type { PlanEntitlements } from './plans';

export type UsageMetric = 'resume_variants' | 'github_repos' | 'recruiter_ai' | 'custom_domains';

export type UsageWindow = 'total' | 'day' | 'month';

export interface UsageCheck {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export const METRIC_WINDOWS: Record<UsageMetric, UsageWindow> = {
  resume_variants: 'total',
  github_repos: 'total',
  recruiter_ai: 'day',
  custom_domains: 'total',
};

export function limitForMetric(metric: UsageMetric, entitlements: PlanEntitlements): number {
  switch (metric) {
    case 'resume_variants':
      return entitlements.resumeVariants;
    case 'github_repos':
      return entitlements.githubRepos;
    case 'recruiter_ai':
      return entitlements.recruiterAiPerDay;
    case 'custom_domains':
      return entitlements.customDomains;
  }
}

export function checkUsage(
  metric: UsageMetric,
  used: number,
  entitlements: PlanEntitlements
): UsageCheck {
  const limit = limitForMetric(metric, entitlements);
  const safeUsed = Math.max(0, used);
  const allowed = safeUsed < limit;
  return {
    allowed,
    used: safeUsed,
    limit,
    remaining: Math.max(limit - safeUsed, 0),
  };
}

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function windowKeyFor(metric: UsageMetric, date = new Date()): string {
  switch (METRIC_WINDOWS[metric]) {
    case 'day':
      return dayKey(date);
    case 'month':
      return monthKey(date);
    case 'total':
      return 'total';
  }
}

export function incrementUsageKey(metric: UsageMetric, date = new Date()): string {
  return windowKeyFor(metric, date);
}

/**
 * First-party funnel instrumentation.
 *
 * Privacy rules (enforced here AND in the funnel_events schema):
 *   - only the allowlisted event names below are ever sent
 *   - metadata is reduced to a small allowlisted key bag; anything else
 *     (resume text, job text, emails, phones, user agents, IPs) is dropped
 *   - fire-and-forget: a tracking failure must never break the product
 */

export const FUNNEL_EVENTS = [
  'signup_started',
  'signup_completed',
  'profile_created',
  'profile_updated',
  'resume_uploaded',
  'resume_extraction_reviewed',
  'profile_completed',
  'portfolio_previewed',
  'portfolio_published',
  'portfolio_unpublished',
  'ats_generated',
  'ats_downloaded',
  'tailoring_started',
  'tailoring_completed',
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export function isFunnelEvent(name: string): name is FunnelEvent {
  return (FUNNEL_EVENTS as readonly string[]).includes(name);
}

interface MetaRule {
  type: 'string' | 'number';
  max: number;
}

const METADATA_ALLOWLIST: Record<string, MetaRule> = {
  source: { type: 'string', max: 40 },
  section: { type: 'string', max: 32 },
  template: { type: 'string', max: 32 },
  reason: { type: 'string', max: 60 },
  count: { type: 'number', max: 1000000 },
};

export type SanitizedEventMeta = {
  source?: string;
  section?: string;
  template?: string;
  reason?: string;
  count?: number;
};

/** Keep only allowlisted, type-correct, length-capped metadata values. */
export function sanitizeEventMeta(meta?: Record<string, unknown>): SanitizedEventMeta {
  if (!meta || typeof meta !== 'object') return {};
  const out: SanitizedEventMeta = {};
  for (const [key, rule] of Object.entries(METADATA_ALLOWLIST)) {
    const value = meta[key];
    if (rule.type === 'string') {
      if (typeof value === 'string' && value.trim().length > 0) {
        (out as Record<string, unknown>)[key] = value.trim().slice(0, rule.max);
      }
    } else {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= rule.max) {
        (out as Record<string, unknown>)[key] = Math.floor(value);
      }
    }
  }
  return out;
}

let disabled = false;

/** Test hook / privacy kill switch. */
export function setAnalyticsEnabled(enabled: boolean): void {
  disabled = !enabled;
}

/**
 * Record a funnel milestone for the signed-in user. Never throws;
 * swallows every failure so product flows are unaffected.
 */
export async function trackEvent(name: string, meta?: Record<string, unknown>): Promise<void> {
  if (disabled) return;
  if (!isFunnelEvent(name)) {
    console.warn(`[analytics] dropped unknown event: ${String(name)}`);
    return;
  }

  try {
    const { getSupabaseClient } = await import('../supabase/client');
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('funnel_events').insert({
      event_name: name,
      metadata: sanitizeEventMeta(meta),
    });
  } catch {
    // Tracking must never break the product.
  }
}

/** Fire-and-forget wrapper for event handlers. */
export function track(name: string, meta?: Record<string, unknown>): void {
  void trackEvent(name, meta);
}

/** Once-per-session guard so page-load events are not double-counted. */
export function oncePerSession(key: string): boolean {
  try {
    const storageKey = `funnel-once:${key}`;
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, '1');
    return true;
  } catch {
    return true;
  }
}

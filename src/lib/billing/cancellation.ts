// End-of-cycle cancellation for the Pro subscription.
//
// Product contract: cancellation never revokes Pro mid-cycle. The user keeps
// every entitlement until current_period_end; only then does the plan fall
// back to free. This mirrors how Razorpay reports cancellations and keeps
// `resolveEntitlements` (which already keys off current_period_end) honest.
//
// The server stays the only writer of user_subscriptions; Razorpay/webhook
// state remains authoritative — if a webhook flips the row back, the flag is
// recomputed from the row, never from client input.

export type CancelAction = 'cancel' | 'resume';

export interface SubscriptionRowLike {
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}

export interface CancellationResult {
  ok: boolean;
  /** Machine-readable failure reason (also safe to show in the UI). */
  code?:
    | 'NOT_FOUND'
    | 'NOT_PRO'
    | 'ALREADY_CANCELED'
    | 'ALREADY_ACTIVE'
    | 'PERIOD_END_MISSING'
    | 'CONFLICT';
  /** The post-action row state, for tests and idempotency checks. */
  row?: {
    plan: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  };
}

/** True when the subscription row represents a paid plan that can be canceled. */
export function isCancelable(row: SubscriptionRowLike): boolean {
  return (row.plan ?? 'free') === 'pro';
}

/**
 * Compute the next row state for a cancel/resume action. Pure: the caller
 * performs the write. Idempotent — repeating the same action yields the same
 * target state rather than an error when the row already matches.
 */
export function applyCancelAction(
  row: SubscriptionRowLike,
  action: CancelAction,
  now = new Date()
): CancellationResult {
  if (!isCancelable(row)) {
    return { ok: false, code: 'NOT_PRO' };
  }

  const periodEnd = row.current_period_end ?? null;
  if (!periodEnd) {
    return { ok: false, code: 'PERIOD_END_MISSING' };
  }

  // A period that already ended means provider state must drive the next
  // event (renewal webhook or expiry); a client cancel is stale.
  if (new Date(periodEnd).getTime() <= now.getTime()) {
    return { ok: false, code: 'CONFLICT' };
  }

  if (action === 'cancel') {
    // Already canceled end-of-cycle → idempotent success, no error.
    if (row.status === 'canceled' || row.cancel_at_period_end === true) {
      return {
        ok: true,
        row: {
          plan: 'pro',
          status: row.status ?? 'active',
          cancel_at_period_end: true,
          current_period_end: periodEnd,
        },
      };
    }
    return {
      ok: true,
      row: {
        plan: 'pro',
        status: 'active', // Pro stays active until period end.
        cancel_at_period_end: true,
        current_period_end: periodEnd,
      },
    };
  }

  // Resume: un-cancel. Idempotent when the flag is already clear.
  if (row.cancel_at_period_end === false && row.status === 'active') {
    return {
      ok: true,
      row: {
        plan: 'pro',
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: periodEnd,
      },
    };
  }
  if (row.status === 'canceled' && row.cancel_at_period_end === true) {
    return {
      ok: true,
      row: {
        plan: 'pro',
        status: 'active',
        cancel_at_period_end: false,
        current_period_end: periodEnd,
      },
    };
  }
  return {
    ok: true,
    row: {
      plan: 'pro',
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: periodEnd,
    },
  };
}

/**
 * Entitlement resolution with cancellation awareness. Before period end a
 * canceled subscription still resolves to Pro; after period end it is free.
 * `resolvePlan` in entitlements.ts already implements the date check — this
 * helper only adds the user-facing description of what happens next.
 */
export function describeCancellation(
  row: SubscriptionRowLike,
  now = new Date()
): {
  effective: 'pro' | 'free';
  cancelsAt: string | null;
  activeUntilEnd: boolean;
} {
  const periodEnd = row.current_period_end ?? null;
  const flag = row.cancel_at_period_end === true || row.status === 'canceled';
  if (!periodEnd || !flag) {
    return { effective: 'pro', cancelsAt: null, activeUntilEnd: true };
  }
  const ended = new Date(periodEnd).getTime() <= now.getTime();
  return {
    effective: ended ? 'free' : 'pro',
    cancelsAt: periodEnd,
    activeUntilEnd: !ended,
  };
}

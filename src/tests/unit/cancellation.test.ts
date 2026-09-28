import { describe, it, expect } from 'vitest';
import {
  applyCancelAction,
  describeCancellation,
  isCancelable,
  type SubscriptionRowLike,
} from '../../lib/billing/cancellation';

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

const activePro: SubscriptionRowLike = {
  plan: 'pro',
  status: 'active',
  current_period_end: FUTURE,
  cancel_at_period_end: false,
};

describe('isCancelable', () => {
  it('only paid plans can be canceled', () => {
    expect(isCancelable(activePro)).toBe(true);
    expect(isCancelable({ plan: 'free', status: 'active' })).toBe(false);
    expect(isCancelable({})).toBe(false);
  });
});

describe('applyCancelAction: cancel', () => {
  it('sets the end-of-cycle flag and keeps Pro active', () => {
    const result = applyCancelAction(activePro, 'cancel');
    expect(result.ok).toBe(true);
    expect(result.row).toMatchObject({
      plan: 'pro',
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: FUTURE,
    });
  });

  it('is idempotent when already canceled end-of-cycle', () => {
    const canceled: SubscriptionRowLike = { ...activePro, cancel_at_period_end: true };
    const again = applyCancelAction(canceled, 'cancel');
    expect(again.ok).toBe(true);
    expect(again.row?.cancel_at_period_end).toBe(true);
    expect(again.row?.status).toBe('active');
  });

  it('refuses free plans', () => {
    const result = applyCancelAction({ plan: 'free', current_period_end: FUTURE }, 'cancel');
    expect(result).toEqual({ ok: false, code: 'NOT_PRO' });
  });

  it('refuses rows without a period end (cannot define "end of cycle")', () => {
    const result = applyCancelAction({ plan: 'pro', status: 'active' }, 'cancel');
    expect(result).toEqual({ ok: false, code: 'PERIOD_END_MISSING' });
  });

  it('flags stale provider state (period already ended) as CONFLICT', () => {
    const result = applyCancelAction({ ...activePro, current_period_end: PAST }, 'cancel');
    expect(result).toEqual({ ok: false, code: 'CONFLICT' });
  });
});

describe('applyCancelAction: resume', () => {
  it('clears the flag and reactivates', () => {
    const canceled: SubscriptionRowLike = {
      ...activePro,
      cancel_at_period_end: true,
      status: 'canceled',
    };
    const result = applyCancelAction(canceled, 'resume');
    expect(result.ok).toBe(true);
    expect(result.row).toMatchObject({
      plan: 'pro',
      status: 'active',
      cancel_at_period_end: false,
    });
  });

  it('is idempotent when the flag is already clear', () => {
    const again = applyCancelAction(activePro, 'resume');
    expect(again.ok).toBe(true);
    expect(again.row?.cancel_at_period_end).toBe(false);
    expect(again.row?.status).toBe('active');
  });

  it('refuses free plans', () => {
    const result = applyCancelAction({ plan: 'free' }, 'resume');
    expect(result).toEqual({ ok: false, code: 'NOT_PRO' });
  });
});

describe('describeCancellation', () => {
  it('pending cancellation keeps Pro until period end', () => {
    const info = describeCancellation({ ...activePro, cancel_at_period_end: true });
    expect(info).toEqual({ effective: 'pro', cancelsAt: FUTURE, activeUntilEnd: true });
  });

  it('after period end the effective plan is free', () => {
    const info = describeCancellation({
      ...activePro,
      current_period_end: PAST,
      cancel_at_period_end: true,
    });
    expect(info.effective).toBe('free');
    expect(info.activeUntilEnd).toBe(false);
  });

  it('no cancellation flag → no scheduled downgrade', () => {
    const info = describeCancellation(activePro);
    expect(info.cancelsAt).toBeNull();
    expect(info.effective).toBe('pro');
  });

  it('status canceled alone implies the flag', () => {
    const info = describeCancellation({ ...activePro, status: 'canceled' });
    expect(info.cancelsAt).toBe(FUTURE);
    expect(info.effective).toBe('pro');
  });
});

-- Stage 7 closure: end-of-cycle subscription cancellation.
--
-- Adds cancel_at_period_end to user_subscriptions. Contract:
--   * cancel_at_period_end = true → the user keeps Pro (and every
--     entitlement) until current_period_end; no mid-cycle downgrade.
--   * A renewal webhook (order.paid) upserts status='active' and MUST clear
--     the flag; expiry falls back to free via the existing date check.
--   * Server rows only: no new client write policies.

BEGIN;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_subscriptions.cancel_at_period_end IS
  'True when the user requested end-of-cycle cancellation; entitlements persist until current_period_end';

COMMIT;

-- Durable webhook idempotency + transactional payment activation.
--
-- The previous design claimed an event with a plain INSERT and then updated
-- the order in separate statements. If the order update failed after the
-- claim succeeded, the event stayed "claimed" forever and Razorpay retries
-- were skipped — a real successful payment could be lost.
--
-- New model:
--   * billing_webhook_events becomes a durable processing ledger
--     (received/processing/processed/failed) where only 'processed' is
--     terminal; 'failed' stays retryable.
--   * process_paid_order_webhook performs signature-free DB work inside ONE
--     transaction: validate the order, guard idempotency, mark the order
--     paid, grant/extend the Pro entitlement, and mark the event processed.
--     Any failure rolls the whole transaction back, so a provider retry can
--     safely re-apply. Concurrent duplicates serialize on the order row lock
--     and cannot double-apply billing.

BEGIN;

-- 1. Ledger columns for the existing idempotency table.
ALTER TABLE public.billing_webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.billing_webhook_events
  DROP CONSTRAINT IF EXISTS billing_webhook_events_status_check;
ALTER TABLE public.billing_webhook_events
  ADD CONSTRAINT billing_webhook_events_status_check
    CHECK (status IN ('received', 'processing', 'processed', 'failed'));

DROP TRIGGER IF EXISTS set_updated_at ON public.billing_webhook_events;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.billing_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. One-transaction payment activation. Callable by the service key only.
CREATE OR REPLACE FUNCTION public.process_paid_order_webhook(
  p_event_id TEXT,
  p_event_type TEXT,
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order public.billing_orders;
  v_now timestamptz := now();
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  -- Idempotency gate: a processed event never re-applies billing.
  IF EXISTS (
    SELECT 1 FROM public.billing_webhook_events
    WHERE event_id = p_event_id AND status = 'processed'
  ) THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  SELECT * INTO v_order FROM public.billing_orders
   WHERE razorpay_order_id = p_razorpay_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'order_not_found');
  END IF;

  -- Record the attempt. The insert is part of the same transaction: if any
  -- later step fails and rolls back, the event remains unclaimed/retryable.
  INSERT INTO public.billing_webhook_events (event_id, event_type, status, attempts, last_error)
  VALUES (p_event_id, p_event_type, 'processing', 1, NULL)
  ON CONFLICT (event_id) DO UPDATE
    SET status = 'processing',
        attempts = public.billing_webhook_events.attempts + 1,
        last_error = NULL;

  IF v_order.status = 'paid' THEN
    -- Already activated (typically by the duplicate of a paired event such
    -- as payment.captured + order.paid). Mark processed without re-granting.
    UPDATE public.billing_webhook_events
       SET status = 'processed', processed_at = v_now
     WHERE event_id = p_event_id;
    RETURN jsonb_build_object('status', 'order_already_paid');
  END IF;

  -- A purchase while Pro is still active extends from the current period end
  -- (never shortens it); a first purchase or expired Pro starts now.
  SELECT us.current_period_end
    INTO v_period_start
    FROM public.user_subscriptions us
   WHERE us.user_id = v_order.user_id
     AND us.plan = 'pro'
     AND us.current_period_end IS NOT NULL
     AND us.current_period_end > v_now;
  v_period_start := COALESCE(v_period_start, v_now);
  v_period_end := v_period_start + interval '1 year';

  UPDATE public.billing_orders
     SET status = 'paid',
         razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
         paid_at = v_now
   WHERE id = v_order.id;

  INSERT INTO public.user_subscriptions
    (user_id, plan, status, current_period_start, current_period_end, provider)
  VALUES (v_order.user_id, 'pro', 'active', v_period_start, v_period_end, 'razorpay')
  ON CONFLICT (user_id) DO UPDATE
    SET plan = 'pro',
        status = 'active',
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        -- Legacy column from the abandoned recurring model; kept to avoid a
        -- destructive migration. A new one-time purchase clears any stale flag.
        cancel_at_period_end = false;

  UPDATE public.billing_webhook_events
     SET status = 'processed', processed_at = v_now
   WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'status', 'processed',
    'period_end', to_char(v_period_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_paid_order_webhook(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_paid_order_webhook(TEXT, TEXT, TEXT, TEXT)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_paid_order_webhook(TEXT, TEXT, TEXT, TEXT)
  TO service_role;

COMMIT;

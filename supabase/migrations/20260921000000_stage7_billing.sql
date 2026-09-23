-- Stage 7: Billing, entitlements, usage, orders

BEGIN;

-- Subscriptions (server-managed; no client writes)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'expired')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscriptions: owner can select"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies: service role / secret key only

-- Billing orders
CREATE TABLE IF NOT EXISTS public.billing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'pro' CHECK (plan_id IN ('pro')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed', 'canceled', 'refunded')),
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS billing_orders_user_id_idx
  ON public.billing_orders (user_id, created_at DESC);

ALTER TABLE public.billing_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders: owner can select"
  ON public.billing_orders FOR SELECT
  USING (auth.uid() = user_id);

-- Webhook idempotency (x-razorpay-event-id)
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: service role / secret key only

-- Usage counters (windowed by metric)
CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN (
    'resume_variants', 'github_repos', 'recruiter_ai', 'tailoring', 'custom_domains'
  )),
  window_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric, window_key)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usage: owner can select"
  ON public.usage_counters FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure updated_at triggers exist
DROP TRIGGER IF EXISTS set_updated_at ON public.user_subscriptions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.billing_orders;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.billing_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.usage_counters;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Revoke anonymous access
REVOKE ALL ON public.user_subscriptions FROM anon;
REVOKE ALL ON public.billing_orders FROM anon;
REVOKE ALL ON public.billing_webhook_events FROM anon;
REVOKE ALL ON public.usage_counters FROM anon;

COMMIT;

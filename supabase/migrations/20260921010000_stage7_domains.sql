-- Stage 7: Custom domains and .CV domains

BEGIN;

CREATE TABLE IF NOT EXISTS public.custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pending_validation', 'active', 'failed', 'removed')),
  verification_token TEXT,
  cloudflare_hostname_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Custom domains: owner can select"
  ON public.custom_domains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = custom_domains.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Custom domains: owner can insert"
  ON public.custom_domains FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Custom domains: owner can delete"
  ON public.custom_domains FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = custom_domains.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.dotcv_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain_label TEXT NOT NULL,
  domain_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'quoted'
    CHECK (status IN ('quoted', 'pending', 'registered', 'failed', 'released')),
  provider TEXT NOT NULL DEFAULT 'ola',
  provider_reference TEXT,
  quote_price_paise INTEGER CHECK (quote_price_paise IS NULL OR quote_price_paise > 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dotcv_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DotCV domains: owner can select"
  ON public.dotcv_domains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = dotcv_domains.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "DotCV domains: owner can insert"
  ON public.dotcv_domains FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "DotCV domains: owner can delete"
  ON public.dotcv_domains FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = dotcv_domains.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS set_updated_at ON public.custom_domains;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.custom_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.dotcv_domains;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.dotcv_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

REVOKE ALL ON public.custom_domains FROM anon;
REVOKE ALL ON public.dotcv_domains FROM anon;

COMMIT;

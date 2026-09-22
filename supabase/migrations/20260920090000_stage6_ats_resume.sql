-- Stage 6: ATS Resume Builder + Job Tailoring

-- Create profile_variants table for resume variants
CREATE TABLE IF NOT EXISTS public.profile_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_role TEXT,
  target_company TEXT,
  job_description_sha256 TEXT,
  job_requirements JSONB,
  variant_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for profile_variants
CREATE POLICY "Variants: owner can select"
  ON public.profile_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_variants.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Variants: owner can insert"
  ON public.profile_variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Variants: owner can update"
  ON public.profile_variants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_variants.profile_id
        AND profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_id
        AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Variants: owner can delete"
  ON public.profile_variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_variants.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profile_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

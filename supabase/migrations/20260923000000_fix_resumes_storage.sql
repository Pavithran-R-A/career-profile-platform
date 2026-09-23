-- Stage 8.2: Corrective migration for resumes storage bucket
-- Original 20260920041000 was applied but bucket creation likely failed silently.
-- This migration ensures the bucket exists idempotently.

BEGIN;

-- Create resumes bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', false, 6291456, ARRAY['application/pdf']::text[])
ON CONFLICT (name) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies to recreate idempotently
DROP POLICY IF EXISTS "Resumes: authenticated can upload" ON storage.objects;
DROP POLICY IF EXISTS "Resumes: authenticated can read own" ON storage.objects;
DROP POLICY IF EXISTS "Resumes: authenticated can delete own" ON storage.objects;

-- Policy: Authenticated users can upload to own folder
CREATE POLICY "Resumes: authenticated can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Authenticated users can read own files
CREATE POLICY "Resumes: authenticated can read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Authenticated users can delete own files
CREATE POLICY "Resumes: authenticated can delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anonymous users have no access (bucket is private, no policies grant anon access)

COMMIT;

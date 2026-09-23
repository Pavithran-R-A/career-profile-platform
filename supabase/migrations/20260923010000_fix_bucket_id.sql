-- Stage 8.2: Fix malformed bucket id
-- Root cause: original migration set id=gen_random_uuid(), name='resumes'
-- App code uses .from("resumes") which looks up by bucket ID, not name
-- Fix: update id from UUID to canonical 'resumes'

BEGIN;

-- Fix the malformed bucket: update id to canonical name
-- This is safe because: verified bucket is empty (0 objects), no policies reference the UUID
UPDATE storage.buckets SET id = 'resumes' WHERE name = 'resumes' AND id != 'resumes';

-- Recreate storage policies against canonical bucket_id = 'resumes'
-- Using IF NOT EXISTS for idempotency

-- INSERT policy (WITH CHECK for insert operations)
DROP POLICY IF EXISTS "Resumes: authenticated can upload" ON storage.objects;
CREATE POLICY "Resumes: authenticated can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT policy
DROP POLICY IF EXISTS "Resumes: authenticated can read own" ON storage.objects;
CREATE POLICY "Resumes: authenticated can read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE policy
DROP POLICY IF EXISTS "Resumes: authenticated can delete own" ON storage.objects;
CREATE POLICY "Resumes: authenticated can delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;

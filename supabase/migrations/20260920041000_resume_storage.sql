-- Stage 2: Resume storage bucket configuration

-- Create resumes storage bucket
-- Note: This is done via Supabase Storage API in production
-- For local development, this migration documents the expected configuration

-- Expected bucket configuration:
-- Name: resumes
-- Visibility: private (not public)
-- File size limit: 6 MiB
-- Allowed MIME types: application/pdf

-- Storage RLS policies (applied via Supabase Dashboard or CLI):
-- 1. Authenticated users can upload to their own folder: {user_id}/*.pdf
-- 2. Authenticated users can read their own files
-- 3. Authenticated users can delete their own files
-- 4. Anonymous users have no access

-- This migration creates the bucket via SQL if supported,
-- otherwise documents the manual configuration needed.

-- For Supabase Storage, we'll use the storage.buckets and storage.objects tables
-- This is a documentation placeholder - actual bucket creation is done via API

-- Verify storage bucket exists
do $$
begin
  if not exists (select 1 from storage.buckets where name = 'resumes') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      gen_random_uuid()::text,
      'resumes',
      false,
      6291456, -- 6 MiB
      array['application/pdf']
    );
  end if;
end $$;

-- Storage RLS policies for resumes bucket
-- Policy: Authenticated users can upload to own folder
create policy "Resumes: authenticated can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Authenticated users can read own files
create policy "Resumes: authenticated can read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Authenticated users can delete own files
create policy "Resumes: authenticated can delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Anonymous users have no access (implicit via bucket being private)

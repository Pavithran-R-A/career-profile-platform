import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import type { ResumeExtraction } from '../ai/provider';
import { validatePDFFile, validatePDFMagicBytes, extractTextFromPDF } from './pdf';
import { assertProfileId, toCustomerMessage } from './errors';

export type ResumeStatus =
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'structuring'
  | 'structured'
  | 'applying'
  | 'applied'
  | 'error';

export interface ResumeSource {
  id: string;
  profile_id: string;
  storage_path: string;
  original_filename: string;
  byte_size: number;
  sha256: string | null;
  page_count: number | null;
  status: ResumeStatus;
  structured_draft: ResumeExtraction | null;
  warnings: string[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class ResumeService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(
    supabaseUrl: string,
    publishableKey: string,
    client?: ReturnType<typeof createClient<Database>>
  ) {
    // A caller-provided client carries the authenticated session. A fresh
    // client has no session, so storage/RLS calls fail as "Unauthorized".
    this.supabase = client ?? createClient<Database>(supabaseUrl, publishableKey);
  }

  async uploadResume(userId: string, profileId: string, file: File): Promise<ResumeSource> {
    // Never let a pseudo-ID like "current" reach the uuid column.
    assertProfileId(profileId);

    const validation = validatePDFFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file');
    }

    const buffer = await file.arrayBuffer();
    const contentValidation = validatePDFMagicBytes(buffer);
    if (!contentValidation.valid) {
      throw new Error(contentValidation.error || 'Invalid PDF content');
    }

    const extraction = await extractTextFromPDF(buffer);

    const fileId = crypto.randomUUID();
    const storagePath = `${userId}/${fileId}.pdf`;

    const { error: uploadError } = await this.supabase.storage
      .from('resumes')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(toCustomerMessage(uploadError, 'save'));
    }

    const { data: resumeData, error: insertError } = await this.supabase
      .from('resume_sources')
      .insert({
        profile_id: profileId,
        storage_path: storagePath,
        original_filename: file.name,
        byte_size: file.size,
        page_count: extraction.pageCount,
        status: 'uploaded',
      })
      .select()
      .single();

    if (insertError) {
      // Compensation: never leave a private object with no metadata row —
      // account deletion would not be able to discover it.
      const { error: cleanupError } = await this.supabase.storage
        .from('resumes')
        .remove([storagePath]);
      if (cleanupError) {
        // Safe operational log only; the customer message stays generic.
        console.error(
          JSON.stringify({
            t: 'resume_upload_compensation_failed',
            storage_path_prefix: `${userId}/`,
          })
        );
      }
      throw new Error(toCustomerMessage(insertError, 'save'));
    }

    return resumeData as unknown as ResumeSource;
  }

  async updateResumeStatus(
    resumeId: string,
    status: ResumeStatus,
    structuredDraft?: ResumeExtraction,
    warnings?: string[],
    errorMessage?: string
  ): Promise<void> {
    const updateData = {
      status,
      ...(structuredDraft !== undefined ? { structured_draft: structuredDraft } : {}),
      ...(warnings !== undefined ? { warnings } : {}),
      ...(errorMessage !== undefined ? { error_message: errorMessage } : {}),
    };

    const { error } = await this.supabase
      .from('resume_sources')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updateData as any)
      .eq('id', resumeId);

    if (error) {
      throw new Error(toCustomerMessage(error, 'save'));
    }
  }

  async getResume(resumeId: string): Promise<ResumeSource | null> {
    const { data, error } = await this.supabase
      .from('resume_sources')
      .select('*')
      .eq('id', resumeId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as unknown as ResumeSource;
  }

  async deleteResume(resumeId: string): Promise<void> {
    const resume = await this.getResume(resumeId);
    if (!resume) {
      throw new Error('Resume not found');
    }

    const { error: storageError } = await this.supabase.storage
      .from('resumes')
      .remove([resume.storage_path]);

    if (storageError) {
      // Order matters: if the object could not be removed, the metadata row
      // must survive so a retry can still find and delete the private file.
      console.error(JSON.stringify({ t: 'resume_delete_storage_failed', resume_id: resumeId }));
      throw new Error(toCustomerMessage(storageError, 'delete'));
    }

    const { error: dbError } = await this.supabase
      .from('resume_sources')
      .delete()
      .eq('id', resumeId);

    if (dbError) {
      // Storage is already clean; only the stale metadata row remains. Say
      // so in the safe log and surface retryable customer guidance.
      console.error(JSON.stringify({ t: 'resume_delete_metadata_failed', resume_id: resumeId }));
      throw new Error(toCustomerMessage(dbError, 'delete'));
    }
  }
}

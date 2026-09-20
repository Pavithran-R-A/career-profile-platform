import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import type { ResumeExtraction } from '../ai/provider';
import { validatePDFFile, validatePDFContent, extractTextFromPDF } from './pdf';

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

  constructor(supabaseUrl: string, publishableKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, publishableKey);
  }

  async uploadResume(userId: string, profileId: string, file: File): Promise<ResumeSource> {
    const validation = validatePDFFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file');
    }

    const buffer = await file.arrayBuffer();
    const contentValidation = validatePDFContent(buffer);
    if (!contentValidation.valid) {
      throw new Error(contentValidation.error || 'Invalid PDF content');
    }

    const extraction = extractTextFromPDF(buffer);

    const fileId = crypto.randomUUID();
    const storagePath = `${userId}/${fileId}.pdf`;

    const { error: uploadError } = await this.supabase.storage
      .from('resumes')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
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
      throw new Error(`Failed to save resume metadata: ${insertError.message}`);
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
      throw new Error(`Failed to update resume status: ${error.message}`);
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

  async getResumesByProfile(profileId: string): Promise<ResumeSource[]> {
    const { data, error } = await this.supabase
      .from('resume_sources')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch resumes: ${error.message}`);
    }

    return (data || []) as unknown as ResumeSource[];
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
      console.error('Failed to delete storage file:', storageError);
    }

    const { error: dbError } = await this.supabase
      .from('resume_sources')
      .delete()
      .eq('id', resumeId);

    if (dbError) {
      throw new Error(`Failed to delete resume: ${dbError.message}`);
    }
  }
}

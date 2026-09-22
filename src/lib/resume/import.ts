import { getSupabaseClient } from '../supabase/client';

export interface ResumeImportPayload {
  profile_id: string;
  template_key?: string;
  accent_key?: string;
  section_order?: string[];
  hidden_sections?: string[];
  education?: EducationEntry[];
  experience?: ExperienceEntry[];
  skills?: SkillEntry[];
  projects?: ProjectEntry[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year_start?: number;
  year_end?: number;
  details?: string;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface SkillEntry {
  name: string;
  category?: string;
}

export interface ProjectEntry {
  name: string;
  description?: string;
  url?: string;
  tech_stack?: string[];
}

export async function applyResumeImport(payload: ResumeImportPayload): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('apply_resume_import' as never, payload as never);

  if (error) return { error: error.message };
  return {};
}

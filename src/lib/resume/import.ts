import { getSupabaseClient } from '../supabase/client';
import type { Json } from '../supabase/database.types';
import type { ResumeExtraction } from '../ai/provider';
import { sanitizeUrl } from '../validators/url';

/**
 * Client contract for the apply_resume_import RPC (v2).
 * The RPC dedupes against existing profile content, skips entries that
 * lack the fields the database requires, and returns an inserted/skipped
 * summary. Dates are integer years/months — never free text.
 */

export interface ExperienceImportEntry {
  role: string;
  company: string;
  location?: string | null;
  start_year: number;
  start_month?: number | null;
  end_year?: number | null;
  end_month?: number | null;
  is_current: boolean;
  description?: string | null;
}

export interface EducationImportEntry {
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  start_year?: number | null;
  start_month?: number | null;
  end_year?: number | null;
  end_month?: number | null;
  description?: string | null;
}

export interface ProjectImportEntry {
  name: string;
  description?: string | null;
  project_url?: string | null;
  repository_url?: string | null;
}

export interface SkillImportEntry {
  name: string;
  category?: string | null;
}

export interface LinkImportEntry {
  label: string;
  url: string;
}

export interface BasicsImport {
  display_name?: string | null;
  headline?: string | null;
  about?: string | null;
  location?: string | null;
}

export type ImportSectionKey =
  'experience' | 'education' | 'projects' | 'skills' | 'links' | 'basics';

export interface ResumeImportPayload {
  profile_id: string;
  experience?: ExperienceImportEntry[];
  education?: EducationImportEntry[];
  projects?: ProjectImportEntry[];
  skills?: SkillImportEntry[];
  links?: LinkImportEntry[];
  basics?: BasicsImport;
}

export interface ResumeImportSummary {
  inserted: Record<ImportSectionKey, number>;
  skipped: Record<ImportSectionKey, number>;
  basics_updated: boolean;
}

/** Parse "YYYY" or "YYYY-MM" (or "YYYY-MM-DD") into year + month. */
export function parseImportDate(value: string | null | undefined): {
  year: number | null;
  month: number | null;
} {
  if (!value) return { year: null, month: null };
  const match = value.match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!match) return { year: null, month: null };
  const year = Number(match[1]);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return { year: null, month: null };
  const month = match[2] ? Number(match[2]) : null;
  const safeMonth = month !== null && month >= 1 && month <= 12 ? month : null;
  return { year, month: safeMonth };
}

/**
 * Map a validated AI extraction into the RPC payload for the selected
 * sections. Returns both the payload and a list of human-readable notes
 * for entries that were dropped client-side (e.g. missing year — we never
 * fabricate dates).
 */
export function buildImportPayload(input: {
  profileId: string;
  extraction: ResumeExtraction;
  selected: Set<ImportSectionKey>;
}): { payload: ResumeImportPayload; droppedNotes: string[] } {
  const { extraction, selected } = input;
  const payload: ResumeImportPayload = { profile_id: input.profileId };
  const droppedNotes: string[] = [];

  if (selected.has('experience')) {
    const entries: ExperienceImportEntry[] = [];
    for (const exp of extraction.experience) {
      const start = parseImportDate(exp.startDate);
      if (!exp.role || !exp.company) {
        droppedNotes.push(`An experience entry without a role or company was skipped.`);
        continue;
      }
      if (start.year === null) {
        droppedNotes.push(
          `${exp.role} at ${exp.company} was skipped because its start year is unclear.`
        );
        continue;
      }
      const end = exp.isCurrent ? null : parseImportDate(exp.endDate);
      entries.push({
        role: exp.role,
        company: exp.company,
        location: exp.location || null,
        start_year: start.year,
        start_month: start.month,
        end_year: exp.isCurrent ? null : (end?.year ?? null),
        end_month: exp.isCurrent ? null : (end?.month ?? null),
        is_current: Boolean(exp.isCurrent),
        description: exp.description || null,
      });
    }
    payload.experience = entries;
  }

  if (selected.has('education')) {
    payload.education = extraction.education
      .filter((edu) => edu.institution)
      .map((edu) => {
        const start = parseImportDate(edu.startDate);
        const end = parseImportDate(edu.endDate);
        return {
          institution: edu.institution,
          degree: edu.degree || null,
          field_of_study: edu.fieldOfStudy || null,
          start_year: start.year,
          start_month: start.month,
          end_year: end.year,
          end_month: end.month,
          description: null,
        };
      });
  }

  if (selected.has('projects')) {
    payload.projects = extraction.projects
      .filter((project) => project.name)
      .map((project) => {
        const url = project.url ? sanitizeUrl(project.url) : undefined;
        const isRepo = url !== undefined && /github\.com|gitlab\.com/i.test(url);
        return {
          name: project.name,
          description: project.description || null,
          project_url: url ?? null,
          repository_url: isRepo ? url : null,
        };
      });
  }

  if (selected.has('skills')) {
    payload.skills = extraction.skills
      .map((skill) => skill.name)
      .filter((name): name is string => Boolean(name && name.trim()))
      .map((name) => ({ name: name.trim() }));
  }

  if (selected.has('links')) {
    payload.links = extraction.links
      .map((link) => ({ label: link.label, url: sanitizeUrl(link.url) }))
      .filter((link): link is { label: string; url: string } => Boolean(link.label && link.url));
  }

  if (selected.has('basics')) {
    const identity = extraction.identity;
    const hasAny =
      Boolean(identity.displayName) ||
      Boolean(identity.headline) ||
      Boolean(identity.about) ||
      Boolean(identity.location);
    if (hasAny) {
      payload.basics = {
        display_name: identity.displayName || null,
        headline: identity.headline || null,
        about: identity.about || null,
        location: identity.location || null,
      };
    }
  }

  return { payload, droppedNotes };
}

export async function applyResumeImport(
  payload: ResumeImportPayload
): Promise<ResumeImportSummary | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('apply_resume_import', {
    payload: payload as unknown as Json,
  });

  if (error) {
    throw new Error(error.message);
  }

  const summary = data as unknown as ResumeImportSummary;
  if (!summary || typeof summary !== 'object') return null;
  return summary;
}

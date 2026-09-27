/**
 * Review model for the CV → profile activation flow.
 *
 * The review screen must make conflicts obvious and must never silently
 * overwrite existing user content. `safe` means "applying this section
 * cannot overwrite or duplicate existing profile content":
 *   - basics fill only empty fields (COALESCE in the RPC)
 *   - skills/links are deduped in the RPC
 *   - experience/education/projects only add rows, but an existing
 *     section means the user must consciously choose to apply
 */

import type { ResumeExtraction } from '../ai/provider';
import type { ProfileWithRelations } from '../profiles/repository';

export type ReviewSectionKey =
  | 'identity'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'links';

export const REVIEW_SECTION_KEYS: ReviewSectionKey[] = [
  'identity',
  'experience',
  'education',
  'skills',
  'projects',
  'links',
];

export interface SectionReview {
  key: ReviewSectionKey;
  title: string;
  hasProposal: boolean;
  existingCount: number;
  proposedCount: number;
  conflictNotes: string[];
  safe: boolean;
  proposalPreview: string[];
  existingPreview: string[];
}

export interface ReviewModel {
  sections: SectionReview[];
  warnings: string[];
  safeKeys: ReviewSectionKey[];
}

const PREVIEW_LIMIT = 3;

function previewLines(lines: string[]): string[] {
  return lines.filter(Boolean).slice(0, PREVIEW_LIMIT);
}

export function buildReviewModel(
  existing: ProfileWithRelations | null,
  draft: ResumeExtraction
): ReviewModel {
  const sections: SectionReview[] = [];

  // ── Identity / basics ─────────────────────────────────────────
  {
    const identity = draft.identity ?? {};
    const fields: Array<{ key: string; label: string; proposed: string | null | undefined; current: string | null | undefined }> = [
      { key: 'display_name', label: 'Display name', proposed: identity.displayName, current: existing?.display_name },
      { key: 'headline', label: 'Headline', proposed: identity.headline, current: existing?.headline },
      { key: 'about', label: 'About', proposed: identity.about, current: existing?.about },
      { key: 'location', label: 'Location', proposed: identity.location, current: existing?.location },
    ];
    const nonEmpty = (v: string | null | undefined): v is string =>
      typeof v === 'string' && v.trim().length > 0;
    const proposed = fields.filter((f) => nonEmpty(f.proposed));
    const current = fields.filter((f) => nonEmpty(f.current));

    const conflictNotes = fields
      .filter((f) => nonEmpty(f.current) && nonEmpty(f.proposed) && f.proposed!.trim() !== f.current!.trim())
      .map((f) => `${f.label} is already set — your current value is kept.`);

    sections.push({
      key: 'identity',
      title: 'Basic Information',
      hasProposal: proposed.length > 0,
      existingCount: current.length,
      proposedCount: proposed.length,
      conflictNotes,
      safe: true,
      proposalPreview: previewLines(proposed.map((f) => `${f.label}: ${f.proposed}`)),
      existingPreview: previewLines(current.map((f) => `${f.label}: ${f.current}`)),
    });
  }

  // ── Experience ────────────────────────────────────────────────
  {
    const proposed = draft.experience ?? [];
    const current = existing?.experiences ?? [];
    sections.push({
      key: 'experience',
      title: 'Experience',
      hasProposal: proposed.length > 0,
      existingCount: current.length,
      proposedCount: proposed.length,
      conflictNotes:
        current.length > 0
          ? [
              `Your profile already has ${current.length} experience ${current.length === 1 ? 'entry' : 'entries'}. New entries are added; duplicates are skipped.`,
            ]
          : [],
      safe: current.length === 0,
      proposalPreview: previewLines(
        proposed.map((e) => `${e.role} at ${e.company}${e.startDate ? ` (${e.startDate})` : ''}`)
      ),
      existingPreview: previewLines(
        current.map((e) => `${e.role} at ${e.company}${e.start_year ? ` (${e.start_year})` : ''}`)
      ),
    });
  }

  // ── Education ─────────────────────────────────────────────────
  {
    const proposed = draft.education ?? [];
    const current = existing?.education ?? [];
    sections.push({
      key: 'education',
      title: 'Education',
      hasProposal: proposed.length > 0,
      existingCount: current.length,
      proposedCount: proposed.length,
      conflictNotes:
        current.length > 0
          ? [
              `Your profile already has ${current.length} education ${current.length === 1 ? 'entry' : 'entries'}. New entries are added; duplicates are skipped.`,
            ]
          : [],
      safe: current.length === 0,
      proposalPreview: previewLines(
        proposed.map((e) => `${e.degree ? `${e.degree} at ` : ''}${e.institution}`)
      ),
      existingPreview: previewLines(
        current.map((e) => `${e.degree ? `${e.degree} at ` : ''}${e.institution}`)
      ),
    });
  }

  // ── Skills ────────────────────────────────────────────────────
  {
    const proposed = draft.skills ?? [];
    const current = existing?.skills ?? [];
    const existingNames = new Set(current.map((s) => s.name.toLowerCase()));
    const newSkills = proposed.filter((s) => !existingNames.has(s.name.toLowerCase()));
    sections.push({
      key: 'skills',
      title: 'Skills',
      hasProposal: proposed.length > 0,
      existingCount: current.length,
      proposedCount: proposed.length,
      conflictNotes:
        newSkills.length < proposed.length
          ? [`${proposed.length - newSkills.length} proposed ${proposed.length - newSkills.length === 1 ? 'skill is' : 'skills are'} already on your profile and will be skipped.`]
          : [],
      safe: true,
      proposalPreview: previewLines([proposed.map((s) => s.name).join(', ')]),
      existingPreview: previewLines([current.map((s) => s.name).join(', ')]),
    });
  }

  // ── Projects ──────────────────────────────────────────────────
  {
    const proposed = draft.projects ?? [];
    const current = existing?.projects ?? [];
    sections.push({
      key: 'projects',
      title: 'Projects',
      hasProposal: proposed.length > 0,
      existingCount: current.length,
      proposedCount: proposed.length,
      conflictNotes:
        current.length > 0
          ? [
              `Your profile already has ${current.length} ${current.length === 1 ? 'project' : 'projects'}. New entries are added; duplicates are skipped.`,
            ]
          : [],
      safe: current.length === 0,
      proposalPreview: previewLines(proposed.map((p) => p.name)),
      existingPreview: previewLines(current.map((p) => p.name)),
    });
  }

  // ── Links ─────────────────────────────────────────────────────
  {
    const proposed = draft.links ?? [];
    const current = existing?.links ?? [];
    const normalizeUrl = (url: string) => url.trim().toLowerCase().replace(/\/+$/, '');
    const existingUrls = new Set(current.map((l) => normalizeUrl(l.url)));
    const newLinks = proposed.filter((l) => !existingUrls.has(normalizeUrl(l.url)));
    sections.push({
      key: 'links',
      title: 'Links',
      hasProposal: proposed.length > 0,
      existingCount: current.length,
      proposedCount: proposed.length,
      conflictNotes:
        newLinks.length < proposed.length
          ? [`${proposed.length - newLinks.length} proposed ${proposed.length - newLinks.length === 1 ? 'link is' : 'links are'} already on your profile and will be skipped.`]
          : [],
      safe: true,
      proposalPreview: previewLines(proposed.map((l) => `${l.label}: ${l.url}`)),
      existingPreview: previewLines(current.map((l) => `${l.label}: ${l.url}`)),
    });
  }

  const safeKeys = sections
    .filter((s) => s.hasProposal && s.safe)
    .map((s) => s.key);

  return {
    sections,
    warnings: draft.warnings ?? [],
    safeKeys,
  };
}

import { sanitizeUrl } from '../../lib/validators/url';
import type { EvidenceRef, ProjectEvidenceRefs } from '../../lib/evidence/public';

/**
 * Subtle, source-named evidence affordances for public portfolios.
 * Evidence names its source (repository / release / project link) instead
 * of using a generic "verified" badge, and is only ever shown when the
 * owner opted in and the profile is published.
 */

export function ProjectEvidence({
  refs,
  mutedColor,
}: {
  refs: ProjectEvidenceRefs;
  mutedColor: string;
}) {
  const items = [refs.repository, refs.release, refs.projectLink].filter(
    (ref): ref is EvidenceRef => Boolean(ref)
  );
  if (items.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" aria-label="Public evidence">
      {items.map((ref, index) => (
        <li key={`${ref.source}-${index}`} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block w-1 h-1 rounded-full"
            style={{ background: mutedColor }}
          />
          <span style={{ color: mutedColor }}>{ref.source}:</span>
          <a
            href={sanitizeUrl(ref.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-70"
            style={{ color: mutedColor }}
            title={ref.label}>
            {ref.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function SkillEvidence({ ref, accent }: { ref: EvidenceRef | null; accent: string }) {
  if (!ref) return null;
  return (
    <a
      href={sanitizeUrl(ref.url)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1"
      title={`Evidence: ${ref.source.toLowerCase()} (${ref.label})`}
      aria-label={`Evidence: ${ref.source.toLowerCase()}, ${ref.label}`}>
      <span
        aria-hidden="true"
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: accent }}
      />
    </a>
  );
}

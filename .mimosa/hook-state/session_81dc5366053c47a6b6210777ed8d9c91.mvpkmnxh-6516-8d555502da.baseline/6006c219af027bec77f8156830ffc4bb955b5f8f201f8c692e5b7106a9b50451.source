import { sanitizeUrl } from '../../lib/validators/url';
import type { PublicAchievementItem } from '../../lib/templates/types';

/**
 * Featured work: owner-curated achievements with optional public source.
 * Language is evidence-honest — "Source", never "verified". Featured items
 * lead; the section renders only when the owner published achievements.
 */
export function FeaturedAchievements({
  achievements,
  accent,
  textColor,
  mutedColor,
  heading,
  headingFont,
}: {
  achievements: PublicAchievementItem[];
  accent: string;
  textColor: string;
  mutedColor: string;
  heading?: string;
  headingFont?: string;
}) {
  if (!Array.isArray(achievements) || achievements.length === 0) return null;

  const ordered = [...achievements].sort(
    (a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order
  );

  return (
    <section className="mb-14">
      <h2
        className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-5"
        style={{ color: accent, fontFamily: headingFont }}>
        {heading ?? 'Featured work'}
      </h2>
      <ol className="space-y-5">
        {ordered.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border p-5"
            style={{ borderColor: mutedColor + '40' }}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-[15px] font-semibold leading-snug" style={{ color: textColor }}>
                {item.title}
              </h3>
              {item.timeframe && (
                <span className="text-xs font-medium tabular-nums" style={{ color: mutedColor }}>
                  {item.timeframe}
                </span>
              )}
            </div>
            {item.metric_text && (
              <p className="text-sm mt-1.5 font-medium" style={{ color: accent }}>
                {item.metric_text}
              </p>
            )}
            {item.description && (
              <p
                className="text-sm leading-relaxed mt-2 max-w-[64ch]"
                style={{ color: mutedColor }}>
                {item.description}
              </p>
            )}
            {item.source_url && sanitizeUrl(item.source_url) && (
              <p className="text-xs mt-2.5">
                <span style={{ color: mutedColor }}>Source: </span>
                <a
                  href={sanitizeUrl(item.source_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:opacity-70"
                  style={{ color: accent }}>
                  {safeHost(item.source_url) ?? 'link'}
                </a>
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

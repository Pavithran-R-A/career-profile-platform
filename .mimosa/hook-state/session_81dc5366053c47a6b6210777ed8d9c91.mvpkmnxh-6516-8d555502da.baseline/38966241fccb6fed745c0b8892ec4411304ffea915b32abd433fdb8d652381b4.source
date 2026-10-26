/** Sitemap generation: public static pages + published public profiles only. */

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .filter((entry) => entry.loc)
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '';
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod ? `\n    ${lastmod}` : ''}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Reduced to a date string, which is all sitemap lastmod allows. */
export function toLastmodDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

export const SITEMAP_MAX_PROFILE_ENTRIES = 5000;

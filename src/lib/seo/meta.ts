/**
 * Page metadata construction. The same builders are used by the Cloudflare
 * worker (server-side head injection for crawler-visible markup) and by the
 * React app (client-side updates for SPA navigation), so what a crawler sees
 * and what a visitor sees can never drift apart.
 */

export const SITE_NAME = 'CVentory';
export const DEFAULT_TITLE = 'CVentory — AI CV, ATS Resume & Career Profile Builder';
export const DEFAULT_DESCRIPTION =
  'Turn your CV, projects and GitHub work into a recruiter-ready career profile, ATS resume and shareable portfolio.';

export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 155;
export const OG_IMAGE_PATH = '/og-cover.png';

export function truncateText(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface PageMeta {
  title: string;
  description?: string;
  canonical?: string;
  ogType?: 'website' | 'profile';
  ogImage?: string;
  noindex?: boolean;
}

/** Canonicalize: UTM/query variants collapse to the clean path URL. */
export function canonicalUrl(origin: string, pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return `${origin.replace(/\/+$/, '')}${clean}`;
}

export function profileMeta(input: {
  displayName: string | null;
  headline: string | null;
  about: string | null;
  canonical: string;
  avatarUrl?: string | null;
  ogImageAbsolute?: string;
}): PageMeta {
  const name = (input.displayName || '').trim();
  const headline = (input.headline || '').trim();
  const about = (input.about || '').trim();

  const title = name
    ? truncateText(`${name} — ${headline || SITE_NAME}`, MAX_TITLE_LENGTH)
    : truncateText(`${headline || 'Career profile'} — ${SITE_NAME}`, MAX_TITLE_LENGTH);

  const description = truncateText(
    about || headline || `${name || 'A career profile'} on ${SITE_NAME}.`,
    MAX_DESCRIPTION_LENGTH
  );

  const avatar = input.avatarUrl && isAbsoluteHttpUrl(input.avatarUrl) ? input.avatarUrl : null;

  return {
    title,
    description,
    canonical: input.canonical,
    ogType: 'profile',
    ogImage: avatar ?? input.ogImageAbsolute,
  };
}

export function siteMeta(input: {
  origin: string;
  pathname: string;
  title: string;
  description?: string;
}): PageMeta {
  return {
    title: truncateText(input.title, MAX_TITLE_LENGTH),
    description: input.description
      ? truncateText(input.description, MAX_DESCRIPTION_LENGTH)
      : undefined,
    canonical: canonicalUrl(input.origin, input.pathname),
    ogType: 'website',
  };
}

export function isAbsoluteHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function tag(property: string, value: string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  return `<meta property="${property}" content="${escapeHtml(value)}" />`;
}

function nameTag(name: string, value: string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  return `<meta name="${name}" content="${escapeHtml(value)}" />`;
}

// ─── Client-side application (SPA navigation parity) ───────────

const SEO_ATTR = 'data-seo-managed';

function upsertTag(
  tag: 'meta' | 'link',
  keyAttr: 'name' | 'property' | 'rel',
  key: string,
  content: string | null
): void {
  if (typeof document === 'undefined') return;
  const head = document.head;
  const selector = `${tag}[${keyAttr}="${key}"]`;
  let el = head.querySelector<HTMLElement>(`${selector}[${SEO_ATTR}]`);
  if (!el) {
    // Adopt a statically emitted tag (index.html) instead of duplicating it.
    const existing = head.querySelector<HTMLElement>(selector);
    if (existing) {
      existing.setAttribute(SEO_ATTR, '1');
      el = existing;
    }
  }
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement(tag);
    el.setAttribute(keyAttr, key);
    el.setAttribute(SEO_ATTR, '1');
    head.appendChild(el);
  }
  el.setAttribute(tag === 'link' ? 'href' : 'content', content);
}

/**
 * Apply page metadata to the document head. Idempotent; managed tags are
 * marked so they can be updated or removed as the visitor navigates.
 */
export function applyPageMeta(meta: PageMeta): void {
  if (typeof document === 'undefined') return;
  document.title = meta.title;

  upsertTag('meta', 'name', 'robots', meta.noindex ? 'noindex' : null);
  upsertTag('meta', 'name', 'description', meta.description ?? null);
  upsertTag('link', 'rel', 'canonical', meta.canonical ?? null);
  upsertTag('meta', 'property', 'og:site_name', SITE_NAME);
  upsertTag('meta', 'property', 'og:title', meta.title);
  upsertTag('meta', 'property', 'og:description', meta.description ?? null);
  upsertTag('meta', 'property', 'og:url', meta.canonical ?? null);
  upsertTag('meta', 'property', 'og:type', meta.ogType ?? 'website');
  upsertTag('meta', 'property', 'og:image', meta.ogImage ?? null);
  const hasImage = Boolean(meta.ogImage);
  upsertTag('meta', 'name', 'twitter:card', hasImage ? 'summary_large_image' : 'summary');
  upsertTag('meta', 'name', 'twitter:title', meta.title);
  upsertTag('meta', 'name', 'twitter:description', meta.description ?? null);
  upsertTag('meta', 'name', 'twitter:image', meta.ogImage ?? null);
}

/**
 * Full set of head tags for one page (server injection + client parity).
 * Always includes the <title> element so the server can REPLACE the static
 * document title (never append a second one).
 */
export function metaTags(meta: PageMeta): string {
  const ogTitle = meta.title;
  const ogDescription = meta.description ?? '';
  const ogUrl = meta.canonical ?? '';
  const ogImage = meta.ogImage ?? '';
  const hasImage = ogImage.length > 0;

  const parts: string[] = [];
  parts.push(`<title>${escapeHtml(meta.title)}</title>`);
  if (meta.noindex) parts.push('<meta name="robots" content="noindex" />');
  parts.push(nameTag('description', meta.description));
  if (meta.canonical) parts.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`);
  parts.push(tag('og:site_name', SITE_NAME));
  parts.push(tag('og:title', ogTitle));
  parts.push(tag('og:description', ogDescription));
  parts.push(tag('og:url', ogUrl));
  parts.push(tag('og:type', meta.ogType ?? 'website'));
  parts.push(tag('og:image', ogImage));
  parts.push(nameTag('twitter:card', hasImage ? 'summary_large_image' : 'summary'));
  parts.push(nameTag('twitter:title', ogTitle));
  parts.push(nameTag('twitter:description', ogDescription));
  parts.push(nameTag('twitter:image', ogImage));
  return parts.filter(Boolean).join('\n');
}

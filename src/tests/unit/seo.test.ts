import { describe, it, expect } from 'vitest';
import {
  truncateText,
  escapeHtml,
  canonicalUrl,
  profileMeta,
  siteMeta,
  metaTags,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from '../../lib/seo/meta';
import {
  buildProfileJsonLd,
  buildSiteJsonLd,
  safeSameAsLinks,
  jsonLdScript,
} from '../../lib/seo/jsonld';
import { buildSitemapXml, toLastmodDate, escapeXml } from '../../lib/seo/sitemap';
import { buildRobotsTxt } from '../../lib/seo/robots';

describe('meta builders', () => {
  it('truncateText collapses whitespace and adds an ellipsis only when needed', () => {
    expect(truncateText('  a   b  c  ', 50)).toBe('a b c');
    expect(truncateText('a'.repeat(70), MAX_TITLE_LENGTH)).toHaveLength(MAX_TITLE_LENGTH);
    expect(truncateText('a'.repeat(70), MAX_TITLE_LENGTH).endsWith('…')).toBe(true);
  });

  it('escapeHtml escapes all five HTML specials', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('canonicalUrl strips trailing slashes from origin and path', () => {
    expect(canonicalUrl('https://example.com/', '/u/alice/')).toBe('https://example.com/u/alice');
    expect(canonicalUrl('https://example.com', '/')).toBe('https://example.com/');
  });

  it('profileMeta prefers the avatar for og:image and falls back to the cover', () => {
    const meta = profileMeta({
      displayName: 'Ada',
      headline: 'Engineer',
      about: 'Short about.',
      canonical: 'https://example.com/u/ada',
      avatarUrl: 'https://cdn.example.com/ada.png',
      ogImageAbsolute: 'https://example.com/og-cover.png',
    });
    expect(meta.ogImage).toBe('https://cdn.example.com/ada.png');
    expect(meta.ogType).toBe('profile');
    expect(meta.canonical).toBe('https://example.com/u/ada');
    expect(meta.title.startsWith('Ada — Engineer')).toBe(true);

    const fallback = profileMeta({
      displayName: null,
      headline: 'Engineer',
      about: null,
      canonical: 'https://example.com/u/ada',
      avatarUrl: 'javascript:alert(1)',
      ogImageAbsolute: 'https://example.com/og-cover.png',
    });
    expect(fallback.ogImage).toBe('https://example.com/og-cover.png');
    expect(fallback.title).toBe('Engineer — CVentory');
  });

  it('siteMeta truncates long titles and descriptions', () => {
    const meta = siteMeta({
      origin: 'https://example.com',
      pathname: '/pricing',
      title: 'x'.repeat(90),
      description: 'y'.repeat(200),
    });
    expect(meta.title).toHaveLength(MAX_TITLE_LENGTH);
    expect(meta.description).toHaveLength(MAX_DESCRIPTION_LENGTH);
    expect(meta.canonical).toBe('https://example.com/pricing');
    expect(meta.ogType).toBe('website');
  });

  it('metaTags escapes values and omits empty tags', () => {
    const html = metaTags({
      title: 'Ada <ada>',
      description: 'She said "hi"',
      canonical: 'https://example.com/u/ada',
      ogType: 'profile',
    });
    expect(html).toContain('&lt;ada&gt;');
    expect(html).toContain('&quot;hi&quot;');
    expect(html).toContain('<link rel="canonical" href="https://example.com/u/ada" />');
    expect(html).not.toContain('og:image');
    expect(html).toContain('twitter:card" content="summary"');

    const noindexed = metaTags({ title: 'Private', noindex: true });
    expect(noindexed).toContain('<meta name="robots" content="noindex" />');
  });
});

describe('JSON-LD', () => {
  const baseLinks = [
    { label: 'LinkedIn', url: 'https://linkedin.com/in/ada' },
    { label: 'GitHub', url: 'https://github.com/ada' },
    { label: 'Evil', url: 'javascript:alert(1)' },
    { label: 'Dup', url: 'https://github.com/ada/' },
  ];

  it('safeSameAsLinks keeps only unique absolute http(s) URLs, capped at 5', () => {
    expect(safeSameAsLinks(baseLinks)).toEqual([
      'https://linkedin.com/in/ada',
      'https://github.com/ada',
    ]);
    const many = Array.from({ length: 8 }, (_, i) => ({
      label: `L${i}`,
      url: `https://example.com/${i}`,
    }));
    expect(safeSameAsLinks(many)).toHaveLength(5);
  });

  it('buildProfileJsonLd never invents role/employer without real experience', () => {
    const data = buildProfileJsonLd({
      username: 'ada',
      displayName: 'Ada Lovelace',
      headline: 'Engineer',
      about: 'Notes on computation.',
      avatarUrl: 'https://cdn.example.com/ada.png',
      url: 'https://example.com/u/ada',
      links: baseLinks,
      experiences: [],
      education: [],
      skills: [],
    }) as { mainEntity: Record<string, unknown> };
    expect(data.mainEntity.jobTitle).toBeUndefined();
    expect(data.mainEntity.employer).toBeUndefined();
    expect(data.mainEntity.alumniOf).toBeUndefined();
    expect(data.mainEntity.image).toBe('https://cdn.example.com/ada.png');
    expect(data.mainEntity.sameAs).toEqual([
      'https://linkedin.com/in/ada',
      'https://github.com/ada',
    ]);
  });

  it('buildProfileJsonLd picks the current role first for jobTitle/employer', () => {
    const data = buildProfileJsonLd({
      username: 'ada',
      displayName: 'Ada',
      headline: null,
      about: null,
      avatarUrl: null,
      url: 'https://example.com/u/ada',
      links: [],
      experiences: [
        { role: 'Old Role', company: 'Old Co', is_current: false, sort_order: 5 },
        { role: 'Current Role', company: 'Current Co', is_current: true, sort_order: 1 },
      ],
      education: [{ institution: 'University of London' }, { institution: '' }],
      skills: [{ name: 'TypeScript' }, { name: '  ' }],
    }) as { mainEntity: Record<string, unknown> };
    expect(data.mainEntity.jobTitle).toBe('Current Role');
    expect(data.mainEntity.employer).toEqual({
      '@type': 'Organization',
      name: 'Current Co',
    });
    expect(data.mainEntity.alumniOf).toEqual([
      { '@type': 'EducationalOrganization', name: 'University of London' },
    ]);
    expect(data.mainEntity.knowsAbout).toEqual(['TypeScript']);
  });

  it('buildSiteJsonLd identifies CVentory as the Organization and WebSite', () => {
    const data = buildSiteJsonLd('https://cventory.example/') as {
      '@graph': Array<Record<string, unknown>>;
    };
    expect(data['@graph'][0]).toMatchObject({
      '@type': 'Organization',
      name: 'CVentory',
      url: 'https://cventory.example/',
    });
    expect(data['@graph'][1]).toMatchObject({
      '@type': 'WebSite',
      name: 'CVentory',
      url: 'https://cventory.example/',
    });
  });

  it('jsonLdScript escapes < and carries an escaped CSP nonce when provided', () => {
    const html = jsonLdScript({ name: 'a<b' }, 'nonce-value');
    expect(html.startsWith('<script type="application/ld+json" nonce="nonce-value">')).toBe(true);
    expect(html).not.toContain('a<b');
    expect(html).toContain('a\\u003cb');

    const escaped = jsonLdScript({ ok: true }, 'a"b');
    expect(escaped).toContain('nonce="a&quot;b"');
  });
});

describe('sitemap', () => {
  it('buildSitemapXml emits urlset with escaped locs and optional lastmod', () => {
    const xml = buildSitemapXml([
      { loc: 'https://example.com/' },
      { loc: 'https://example.com/u/ada', lastmod: '2026-01-02' },
      { loc: '' },
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<lastmod>2026-01-02</lastmod>');
    const urls = (xml.match(/<url>/g) ?? []).length;
    expect(urls).toBe(2);
  });

  it('escapeXml escapes XML specials', () => {
    expect(escapeXml('a & b < c > "d"')).toBe('a &amp; b &lt; c &gt; &quot;d&quot;');
  });

  it('toLastmodDate reduces ISO timestamps to dates and rejects garbage', () => {
    expect(toLastmodDate('2026-01-02T03:04:05Z')).toBe('2026-01-02');
    expect(toLastmodDate(null)).toBeUndefined();
    expect(toLastmodDate('not-a-date')).toBeUndefined();
  });
});

describe('robots', () => {
  it('allows public content and disallows private routes + API', () => {
    const txt = buildRobotsTxt('https://example.com/');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Disallow: /dashboard/');
    expect(txt).toContain('Disallow: /login');
    expect(txt).toContain('Disallow: /api/');
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(txt).not.toContain('/u/');
  });
});

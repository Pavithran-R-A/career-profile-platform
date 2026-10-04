/**
 * Server-side search metadata for crawler-visible markup.
 *
 * With `run_worker_first`, these paths reach the worker before static assets:
 *   /            → site meta (canonical + OG with absolute URLs)
 *   /pricing     → site meta
 *   /u/:username → published-profile meta + ProfilePage JSON-LD, or noindex
 *   /sitemap.xml → published profiles + public static pages
 *   /robots.txt  → allow public, disallow app routes, absolute sitemap ref
 *
 * Profile reads use the publishable (anon-equivalent) key against the
 * anon-granted `public_profiles` view — no service key, no private data.
 */

import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  OG_IMAGE_PATH,
  metaTags,
  profileMeta,
  siteMeta,
} from '../lib/seo/meta';
import { buildProfileJsonLd, buildSiteJsonLd, jsonLdScript } from '../lib/seo/jsonld';
import {
  SITEMAP_MAX_PROFILE_ENTRIES,
  buildSitemapXml,
  toLastmodDate,
  type SitemapEntry,
} from '../lib/seo/sitemap';
import { buildRobotsTxt } from '../lib/seo/robots';
import type { Env } from './handler';

interface SeoProfileRow {
  username: string;
  display_name: string | null;
  headline: string | null;
  about: string | null;
  avatar_url: string | null;
  updated_at: string;
  links: Array<{ label: string; url: string }>;
  experiences: Array<{ role: string; company: string; is_current: boolean; sort_order: number }>;
  education: Array<{ institution: string }>;
  skills: Array<{ name: string }>;
}

function originOf(request: Request): string {
  return new URL(request.url).origin;
}

async function fetchPublishedProfile(username: string, env: Env): Promise<SeoProfileRow | null> {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey || !username) return null;

  try {
    const supabase = createClient(supabaseUrl, publishableKey);
    const { data, error } = await supabase
      .from('public_profiles' as never)
      .select(
        'username, display_name, headline, about, avatar_url, updated_at, links, experiences, education, skills'
      )
      .eq('username', username as never)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as unknown as SeoProfileRow;
    return {
      username: row.username,
      display_name: row.display_name ?? null,
      headline: row.headline ?? null,
      about: row.about ?? null,
      avatar_url: row.avatar_url ?? null,
      updated_at: row.updated_at,
      links: Array.isArray(row.links) ? row.links : [],
      experiences: Array.isArray(row.experiences) ? row.experiences : [],
      education: Array.isArray(row.education) ? row.education : [],
      skills: Array.isArray(row.skills) ? row.skills : [],
    };
  } catch {
    return null;
  }
}

export function handleRobots(request: Request): Response {
  return new Response(buildRobotsTxt(originOf(request)), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function handleSitemap(request: Request, env: Env): Promise<Response> {
  const origin = originOf(request);
  const entries: SitemapEntry[] = [{ loc: `${origin}/` }, { loc: `${origin}/pricing` }];

  try {
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && publishableKey) {
      const supabase = createClient(supabaseUrl, publishableKey);
      const { data, error } = await supabase
        .from('public_profiles' as never)
        .select('username, updated_at')
        .order('updated_at', { ascending: false } as never)
        .limit(SITEMAP_MAX_PROFILE_ENTRIES as never);

      if (!error && Array.isArray(data)) {
        for (const row of data as Array<{ username: string; updated_at: string }>) {
          if (!row?.username) continue;
          entries.push({
            loc: `${origin}/u/${encodeURIComponent(row.username)}`,
            lastmod: toLastmodDate(row.updated_at),
          });
        }
      }
    }
  } catch {
    // Degrade to static pages only rather than failing the sitemap.
  }

  return new Response(buildSitemapXml(entries), {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

export function isHtmlPagePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/pricing' || pathname.startsWith('/u/');
}

/** Unknown SPA routes still get truthful not-found meta (QA SEO defects). */
function notFoundInjection(request: Request) {
  const origin = originOf(request);
  const meta = {
    title: 'Page not found — CVentory',
    description: 'The page you requested does not exist.',
    canonical: `${origin}${new URL(request.url).pathname}`,
    noindex: true,
    ogImage: `${origin}${OG_IMAGE_PATH}`,
  };
  return metaTags(meta);
}

/**
 * Replaces the static index.html <title> with the page-specific one. After
 * this runs there is EXACTLY ONE title element in the document.
 */
function replaceStaticTitle(html: string, injection: string): string {
  const titleMatch = injection.match(/<title>[\s\S]*?<\/title>/i);
  if (!titleMatch) return html;
  const withoutTitle = injection.replace(titleMatch[0], '');
  const hadStaticTitle = /<title[\s\S]*?<\/title>/i.test(html);
  let next = html;
  if (hadStaticTitle) {
    next = html.replace(/<title[\s\S]*?<\/title>/i, titleMatch[0]);
  } else {
    next = html.replace(/<head>/i, `<head>\n${titleMatch[0]}`);
  }
  if (withoutTitle.trim().length > 0) {
    next = next.replace(/<head>/i, `<head>\n${withoutTitle}`);
  }
  return next;
}

function siteInjection(request: Request, pathname: string, title: string, description: string) {
  const origin = originOf(request);
  const ogImage = `${origin}${OG_IMAGE_PATH}`;
  const meta = { ...siteMeta({ origin, pathname, title, description }), ogImage };
  return metaTags(meta);
}

export async function handleHtmlPage(
  request: Request,
  assets: Fetcher,
  env: Env
): Promise<Response> {
  const upstream = await assets.fetch(request);
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return upstream;

  const url = new URL(request.url);
  const origin = url.origin;
  let html = await upstream.text();

  let injection = '';

  if (url.pathname === '/') {
    injection = `${siteInjection(request, '/', DEFAULT_TITLE, DEFAULT_DESCRIPTION)}\n${jsonLdScript(
      buildSiteJsonLd(origin)
    )}`;
  } else if (url.pathname === '/pricing') {
    injection = siteInjection(
      request,
      '/pricing',
      'Pricing — CVentory',
      'Free to build your career profile, portfolio, and ATS resume. Pro adds higher limits.'
    );
  } else if (url.pathname.startsWith('/u/')) {
    const username = decodeURIComponent(url.pathname.slice(3)).replace(/\/+$/, '');
    const profile = await fetchPublishedProfile(username, env);

    if (profile) {
      const canonical = `${origin}/u/${encodeURIComponent(profile.username)}`;
      const meta = profileMeta({
        displayName: profile.display_name,
        headline: profile.headline,
        about: profile.about,
        canonical,
        avatarUrl: profile.avatar_url,
        ogImageAbsolute: `${origin}${OG_IMAGE_PATH}`,
      });
      const jsonLd = buildProfileJsonLd({
        username: profile.username,
        displayName: profile.display_name,
        headline: profile.headline,
        about: profile.about,
        avatarUrl: profile.avatar_url,
        url: canonical,
        links: profile.links,
        experiences: profile.experiences,
        education: profile.education,
        skills: profile.skills,
      });
      injection = `${metaTags(meta)}\n${jsonLdScript(jsonLd)}`;
    } else {
      // Unknown/draft profile: truthful not-found meta, noindex.
      injection = metaTags({
        title: 'Profile not found — CVentory',
        description: 'This profile does not exist or is not published.',
        canonical: `${origin}/u/${encodeURIComponent(username)}`,
        noindex: true,
        ogImage: `${origin}${OG_IMAGE_PATH}`,
      });
    }
  } else {
    injection = notFoundInjection(request);
  }

  if (injection) {
    html = replaceStaticTitle(html, injection);
  }

  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(html, { status: upstream.status, headers });
}

/**
 * schema.org structured data for public profiles.
 *
 * Truthfulness rules:
 *   - only fields that actually exist on the published profile are emitted
 *   - jobTitle / employer come from a real experience entry (never invented)
 *   - alumniOf comes from real education entries
 *   - knowsAbout comes from the profile's own skill list
 *   - sameAs only contains safe absolute http(s) links the profile published
 */

import { isAbsoluteHttpUrl } from './meta';

export interface JsonLdExperienceLike {
  role: string;
  company: string;
  is_current: boolean;
  sort_order: number;
}

export interface JsonLdProfileInput {
  username: string;
  displayName: string | null;
  headline: string | null;
  about: string | null;
  avatarUrl: string | null;
  url: string;
  links: Array<{ label: string; url: string }>;
  experiences: JsonLdExperienceLike[];
  education: Array<{ institution: string }>;
  skills: Array<{ name: string }>;
}

const SAME_AS_MAX = 5;
const ALUMNI_MAX = 3;
const SKILLS_MAX = 12;

/** Filter profile links down to unique, safe absolute http(s) URLs. */
export function safeSameAsLinks(links: Array<{ label: string; url: string }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const link of links) {
    if (!link || typeof link.url !== 'string') continue;
    if (!isAbsoluteHttpUrl(link.url)) continue;
    const normalized = link.url.toLowerCase().replace(/\/+$/, '');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(link.url);
    if (out.length >= SAME_AS_MAX) break;
  }
  return out;
}

export function buildProfileJsonLd(input: JsonLdProfileInput): Record<string, unknown> {
  const name = (input.displayName || '').trim() || input.username;
  const person: Record<string, unknown> = { '@type': 'Person', name };

  if (input.url) person.url = input.url;
  if (input.avatarUrl && isAbsoluteHttpUrl(input.avatarUrl)) person.image = input.avatarUrl;

  const description = (input.about || '').trim() || (input.headline || '').trim();
  if (description) person.description = description;

  const sameAs = safeSameAsLinks(input.links);
  if (sameAs.length > 0) person.sameAs = sameAs;

  // Current role first, then the most recent listed experience.
  const sorted = [...input.experiences].sort(
    (a, b) => Number(b.is_current) - Number(a.is_current) || b.sort_order - a.sort_order
  );
  const latest = sorted.find((e) => e.role && e.company);
  if (latest) {
    person.jobTitle = latest.role;
    person.employer = { '@type': 'Organization', name: latest.company };
  }

  const alumni = input.education
    .filter((e) => e.institution && e.institution.trim())
    .slice(0, ALUMNI_MAX)
    .map((e) => ({ '@type': 'EducationalOrganization', name: e.institution.trim() }));
  if (alumni.length > 0) person.alumniOf = alumni;

  const skills = input.skills
    .map((s) => s.name)
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .slice(0, SKILLS_MAX);
  if (skills.length > 0) person.knowsAbout = skills;

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name,
    mainEntity: person,
  };
}

export function jsonLdScript(data: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}


const CVENTORY_DESCRIPTION =
  'CVentory is an AI career profile platform that turns your CV, projects and GitHub work into a recruiter-ready profile, ATS resume and shareable portfolio.';

export function buildSiteJsonLd(originInput: string): Record<string, unknown> {
  const origin = originInput.replace(/\/+$/, '');
  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'CVentory',
        alternateName: 'CVentory AI Career Profile Platform',
        url: `${origin}/`,
        description: CVENTORY_DESCRIPTION,
        logo: {
          '@type': 'ImageObject',
          url: `${origin}/logo.svg`,
          contentUrl: `${origin}/logo.svg`,
          width: 512,
          height: 512,
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: 'CVentory',
        url: `${origin}/`,
        description: CVENTORY_DESCRIPTION,
        publisher: { '@id': organizationId },
      },
    ],
  };
}

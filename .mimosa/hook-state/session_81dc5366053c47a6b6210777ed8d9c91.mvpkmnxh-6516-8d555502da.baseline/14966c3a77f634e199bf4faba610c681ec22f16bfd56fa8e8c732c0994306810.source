/** robots.txt: allow public content, keep private/app routes out of crawlers. */

export function buildRobotsTxt(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard/',
    'Disallow: /login',
    'Disallow: /signup',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    'Disallow: /verify-email',
    'Disallow: /auth/',
    'Disallow: /onboarding',
    'Disallow: /api/',
    '',
    `Sitemap: ${cleanOrigin}/sitemap.xml`,
    '',
  ].join('\n');
}

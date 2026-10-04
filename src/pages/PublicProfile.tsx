import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { getPublicProfileByUsername, type PublicPortfolioResult } from '../lib/profiles/public';
import { getTemplate, normalizeSectionOrder } from '../lib/templates/types';
import { ensureTemplatesRegistered, getTemplateComponent } from '../lib/templates/registry';
import { profileMeta } from '../lib/seo/meta';
import { usePageMeta } from '../lib/seo/usePageMeta';
import { buildProfileJsonLd } from '../lib/seo/jsonld';
import { track, oncePerSession } from '../lib/analytics/events';
import { sanitizeUrl } from '../lib/validators/url';
import ShareControls from '../components/ShareControls';
import RecruiterAsk from '../components/RecruiterAsk';

const JSONLD_ID = 'profile-jsonld';

function injectProfileJsonLd(data: Record<string, unknown> | null): void {
  if (typeof document === 'undefined') return;
  document.getElementById(JSONLD_ID)?.remove();
  if (!data) return;
  const script = document.createElement('script');
  script.id = JSONLD_ID;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  document.head.appendChild(script);
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const [portfolio, setPortfolio] = useState<PublicPortfolioResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;

    setLoading(true);
    setError(null);

    getPublicProfileByUsername(username)
      .then((data) => {
        if (!data) {
          setError('Profile not found or not published');
          injectProfileJsonLd(null);
          return;
        }
        setPortfolio(data);
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [username]);

  const meta = useMemo(() => {
    if (!portfolio || !username) return null;
    const p = portfolio.profile;
    return profileMeta({
      displayName: p.display_name,
      headline: p.headline,
      about: p.about,
      canonical: `${window.location.origin}/u/${encodeURIComponent(p.username)}`,
      avatarUrl: p.avatar_url,
      ogImageAbsolute: `${window.location.origin}/og-cover.png`,
    });
  }, [portfolio, username]);

  const notFoundMeta = useMemo(() => {
    if (!error || !username) return null;
    return {
      title: 'Profile not found — CVentory',
      description: 'This profile does not exist or is not published.',
      canonical: `${window.location.origin}/u/${encodeURIComponent(username)}`,
      noindex: true,
    };
  }, [error, username]);

  usePageMeta(meta ?? notFoundMeta);

  useEffect(() => {
    if (!portfolio) return;
    const p = portfolio.profile;
    injectProfileJsonLd(
      buildProfileJsonLd({
        username: p.username,
        displayName: p.display_name,
        headline: p.headline,
        about: p.about,
        avatarUrl: p.avatar_url,
        url: `${window.location.origin}/u/${encodeURIComponent(p.username)}`,
        links: p.links,
        experiences: p.experiences,
        education: p.education,
        skills: p.skills,
      })
    );
    if (oncePerSession(`preview:${p.username}`)) {
      // Public view of another person's portfolio is not tracked (no session
      // for anonymous visitors); owner previews track on the dashboard side.
      track('portfolio_previewed', { template: portfolio.preferences.template_key });
    }
  }, [portfolio]);

  if (loading) {
    return (
      <div className="page-shell" role="status" aria-label="Loading profile">
        <div className="space-y-4">
          <div className="skeleton h-10 w-64 mx-auto" />
          <div className="skeleton h-4 w-48 mx-auto" />
          <div className="skeleton h-64 w-full mt-8" />
        </div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl font-bold text-[var(--ink)]">404</p>
          <h1 className="text-xl font-semibold mt-4 text-[var(--ink)]">Profile not found</h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            This profile does not exist or is not published.
          </p>
          <Link to="/" className="btn btn-secondary mt-6">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  ensureTemplatesRegistered();
  const templateKey = portfolio.preferences.template_key || 'minimal';
  const template = getTemplate(templateKey) ?? getTemplate('minimal')!;
  const TemplateComponent = getTemplateComponent(templateKey);
  const profile = portfolio.profile;
  const shareUrl = `${window.location.origin}/u/${encodeURIComponent(profile.username)}`;

  // Recruiter conversion: owner-configured public links only. Auth email is
  // never exposed; a public contact email requires an explicit profile link.
  const CONTACT_LABEL_RE = /email|mail|contact/i;
  const contactLink = profile.links.find(
    (l) => CONTACT_LABEL_RE.test(l.label) || /mailto:/i.test(l.url)
  );
  const actionLinks = profile.links.filter((l) => l !== contactLink).slice(0, 4);

  return (
    <div>
      <TemplateComponent
        profile={profile}
        config={template.config}
        preferences={{
          accentKey: portfolio.preferences.accent_key,
          sectionOrder: normalizeSectionOrder(portfolio.preferences.section_order),
          hiddenSections: portfolio.preferences.hidden_sections,
        }}
      />
      <footer className="border-t border-[var(--border)] py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] p-5 sm:p-6 mb-8"
            aria-label="Contact and links">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
              Get in touch
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {contactLink && (
                <a
                  href={sanitizeUrl(contactLink.url) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary !min-h-[44px] !py-2.5">
                  {CONTACT_LABEL_RE.test(contactLink.label) ? contactLink.label : 'Email'}
                </a>
              )}
              {actionLinks.map((link) => (
                <a
                  key={link.id}
                  href={sanitizeUrl(link.url) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary !min-h-[44px] !py-2.5">
                  {link.label}
                </a>
              ))}
              {profile.links.length === 0 && (
                <p className="text-sm text-[var(--muted-foreground)]">
                  This candidate hasn&apos;t added public contact links yet.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-[var(--faint-foreground)]">
              Career profile on{' '}
              <Link to="/" className="underline underline-offset-2">
                CVentory
              </Link>
            </p>
            <ShareControls
              url={shareUrl}
              title={`${profile.display_name || profile.username} — career profile`}
            />
          </div>
        </div>
      </footer>
      {/* Recruiter Q&A sits between the portfolio and the global footer;
          renders only when the deployment enables the assistant. */}
      <RecruiterAsk username={profile.username} />
    </div>
  );
}

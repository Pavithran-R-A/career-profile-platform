import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { getPublicProfileByUsername, type PublicPortfolioResult } from '../lib/profiles/public';
import { getTemplate, normalizeSectionOrder } from '../lib/templates/types';
import { ensureTemplatesRegistered, getTemplateComponent } from '../lib/templates/registry';

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
          return;
        }
        setPortfolio(data);
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [username]);

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

  return (
    <TemplateComponent
      profile={portfolio.profile}
      config={template.config}
      preferences={{
        accentKey: portfolio.preferences.accent_key,
        sectionOrder: normalizeSectionOrder(portfolio.preferences.section_order),
        hiddenSections: portfolio.preferences.hidden_sections,
      }}
    />
  );
}

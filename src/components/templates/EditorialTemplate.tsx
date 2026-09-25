import { useState } from 'react';
import {
  normalizeSectionOrder,
  type TemplateConfig,
  type PortfolioProfile,
} from '../../lib/templates/types';
import { sanitizeUrl } from '../../lib/validators/url';
import { formatDateRange } from '../../lib/profiles/date-format';
import { LinkIcon } from '../portfolio/links';

interface TemplatePreferences {
  accentKey: string;
  sectionOrder: string[];
  hiddenSections: string[];
}

interface EditorialTemplateProps {
  profile: PortfolioProfile;
  config: TemplateConfig;
  preferences?: TemplatePreferences;
}

const ACCENT_COLORS: Record<string, string> = {
  blue: '#2563eb',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  emerald: '#059669',
  teal: '#0d9488',
  amber: '#d97706',
  rose: '#e11d48',
  slate: '#475569',
};

const DEFAULT_ORDER = ['basics', 'experience', 'projects', 'skills', 'education', 'links'];
const EXP_COLLAPSE_AT = 5;

function resolveAccent(accentKey: string | undefined, config: TemplateConfig): string {
  return ACCENT_COLORS[accentKey ?? ''] ?? config.colors.accent;
}

function SectionHeading({
  label,
  accent,
  config,
}: {
  label: string;
  accent: string;
  config: TemplateConfig;
}) {
  return (
    <div className="flex items-baseline gap-4 mb-6">
      <span
        aria-hidden="true"
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: accent }}
      />
      <h2
        className="text-sm font-bold uppercase tracking-[0.18em]"
        style={{ color: config.colors.text, fontFamily: config.fonts.heading }}>
        {label}
      </h2>
      <span
        aria-hidden="true"
        className="flex-1 h-px"
        style={{ backgroundColor: config.colors.muted + '40' }}
      />
    </div>
  );
}

export default function EditorialTemplate({
  profile,
  config,
  preferences,
}: EditorialTemplateProps) {
  const accent = resolveAccent(preferences?.accentKey, config);
  const order = preferences?.sectionOrder?.length
    ? normalizeSectionOrder(preferences.sectionOrder)
    : DEFAULT_ORDER;
  const hidden = new Set(preferences?.hiddenSections ?? []);
  const [showAllExp, setShowAllExp] = useState(false);

  const muted = config.colors.muted;
  const visibleExps =
    showAllExp || profile.experiences.length <= EXP_COLLAPSE_AT
      ? profile.experiences
      : profile.experiences.slice(0, EXP_COLLAPSE_AT);
  const hiddenExpCount = profile.experiences.length - visibleExps.length;

  const sectionMap: Record<string, React.ReactNode> = {
    basics: profile.about ? (
      <section key="basics" className="mb-14">
        <p
          className="text-lg leading-[1.7] max-w-[58ch]"
          style={{ color: config.colors.text, fontFamily: config.fonts.heading }}>
          {profile.about}
        </p>
      </section>
    ) : null,

    experience:
      profile.experiences.length > 0 ? (
        <section key="experience" className="mb-14">
          <SectionHeading label="Experience" accent={accent} config={config} />
          <div className="space-y-7">
            {visibleExps.map((exp) => (
              <article
                key={exp.id}
                className="relative pl-6"
                style={{ borderLeft: `2px solid ${muted}30` }}>
                <span
                  aria-hidden="true"
                  className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3
                    className="text-lg font-bold leading-tight"
                    style={{ color: config.colors.text, fontFamily: config.fonts.heading }}>
                    {exp.role}
                  </h3>
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: muted, fontFamily: config.fonts.mono }}>
                    {formatDateRange({
                      startYear: exp.start_year,
                      startMonth: exp.start_month,
                      endYear: exp.end_year,
                      endMonth: exp.end_month,
                      current: exp.is_current,
                    })}
                  </span>
                </div>
                <p className="text-sm font-semibold mt-1" style={{ color: accent }}>
                  {exp.company}
                  {exp.location ? ` · ${exp.location}` : ''}
                </p>
                {exp.description && (
                  <p className="text-sm leading-relaxed mt-2 max-w-[62ch]" style={{ color: muted }}>
                    {exp.description}
                  </p>
                )}
              </article>
            ))}
          </div>
          {hiddenExpCount > 0 && !showAllExp && (
            <button
              type="button"
              onClick={() => setShowAllExp(true)}
              aria-expanded={false}
              className="mt-5 text-sm font-semibold underline underline-offset-4 hover:opacity-70"
              style={{ color: accent }}>
              Read all {profile.experiences.length} roles
            </button>
          )}
        </section>
      ) : null,

    projects:
      profile.projects.length > 0 ? (
        <section key="projects" className="mb-14">
          <SectionHeading label="Selected work" accent={accent} config={config} />
          <div className="space-y-6">
            {profile.projects.map((proj, i) => (
              <article
                key={proj.id}
                className="rounded-2xl p-6 border"
                style={{
                  borderColor: muted + '30',
                  backgroundColor: i % 2 === 0 ? muted + '0D' : 'transparent',
                }}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3
                    className="text-base font-bold"
                    style={{ color: config.colors.text, fontFamily: config.fonts.heading }}>
                    {proj.name}
                  </h3>
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: accent, fontFamily: config.fonts.mono }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                {proj.description && (
                  <p className="text-sm leading-relaxed mt-2 max-w-[60ch]" style={{ color: muted }}>
                    {proj.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold">
                  {proj.project_url && (
                    <a
                      href={sanitizeUrl(proj.project_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:opacity-70"
                      style={{ color: accent }}>
                      View live →
                    </a>
                  )}
                  {proj.repository_url && (
                    <a
                      href={sanitizeUrl(proj.repository_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:opacity-70"
                      style={{ color: muted }}>
                      Source code
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null,

    skills:
      profile.skills.length > 0 ? (
        <section key="skills" className="mb-14">
          <SectionHeading label="Skills" accent={accent} config={config} />
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((s) => (
              <span
                key={s.id}
                className="text-[13px] font-medium px-3 py-1 rounded-full"
                style={{ backgroundColor: accent + '14', color: accent }}>
                {s.name}
              </span>
            ))}
          </div>
        </section>
      ) : null,

    education:
      profile.education.length > 0 ? (
        <section key="education" className="mb-14">
          <SectionHeading label="Education" accent={accent} config={config} />
          <div className="space-y-5">
            {profile.education.map((edu) => (
              <div
                key={edu.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: config.colors.text }}>
                    {edu.institution}
                  </h3>
                  <p className="text-sm" style={{ color: muted }}>
                    {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ')}
                  </p>
                </div>
                <span
                  className="text-xs tabular-nums"
                  style={{ color: muted, fontFamily: config.fonts.mono }}>
                  {formatDateRange({
                    startYear: edu.start_year,
                    startMonth: edu.start_month,
                    endYear: edu.end_year,
                    endMonth: edu.end_month,
                    current: !edu.end_year,
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null,

    links:
      profile.links.length > 0 ? (
        <footer key="links" className="pt-8 border-t" style={{ borderColor: muted + '40' }}>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {profile.links.map((link) => (
              <a
                key={link.id}
                href={sanitizeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-70"
                style={{ color: accent }}>
                <LinkIcon label={link.label} url={link.url} size={15} />
                {link.label}
              </a>
            ))}
          </div>
        </footer>
      ) : null,
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: config.colors.background,
        color: config.colors.text,
        fontFamily: config.fonts.body,
      }}>
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[290px_1fr] min-h-screen">
        <aside
          className="px-8 sm:px-9 py-14 md:py-16 border-b md:border-b-0 md:border-r"
          style={{ backgroundColor: accent + '0A', borderColor: muted + '30' }}>
          <div className="md:sticky md:top-14">
            {profile.avatar_url && (
              <img
                src={sanitizeUrl(profile.avatar_url)}
                alt={profile.display_name ?? profile.username}
                className="w-24 h-24 rounded-2xl mb-6 object-cover"
              />
            )}
            <h1
              className="font-bold tracking-[-0.02em] leading-[1.06]"
              style={{
                fontFamily: config.fonts.heading,
                fontSize: 'clamp(1.9rem, 1.3rem + 2vw, 2.5rem)',
                color: config.colors.text,
              }}>
              {profile.display_name || profile.username}
            </h1>
            {profile.headline && (
              <p className="mt-3 text-[15px] font-medium leading-snug" style={{ color: accent }}>
                {profile.headline}
              </p>
            )}
            {profile.location && (
              <p className="mt-2 text-sm" style={{ color: muted }}>
                {profile.location}
              </p>
            )}
            <div className="mt-6 space-y-2.5">
              {profile.links.map((link) => (
                <a
                  key={link.id}
                  href={sanitizeUrl(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm hover:opacity-70"
                  style={{ color: muted }}>
                  <LinkIcon label={link.label} url={link.url} size={15} />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <main className="px-7 sm:px-10 py-14 md:py-16">
          {order.map((section) =>
            hidden.has(section) ? null : <div key={section}>{sectionMap[section] ?? null}</div>
          )}
        </main>
      </div>
    </div>
  );
}

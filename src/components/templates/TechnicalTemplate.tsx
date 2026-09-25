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

interface TechnicalTemplateProps {
  profile: PortfolioProfile;
  config: TemplateConfig;
  preferences?: TemplatePreferences;
}

const ACCENT_COLORS: Record<string, string> = {
  blue: '#60a5fa',
  indigo: '#818cf8',
  violet: '#a78bfa',
  emerald: '#34d399',
  teal: '#2dd4bf',
  amber: '#fbbf24',
  rose: '#fb7185',
  slate: '#94a3b8',
};

const DEFAULT_ORDER = ['basics', 'projects', 'experience', 'skills', 'education', 'links'];
const EXP_COLLAPSE_AT = 5;

function resolveAccent(accentKey: string | undefined, config: TemplateConfig): string {
  return ACCENT_COLORS[accentKey ?? ''] ?? config.colors.accent;
}

function SectionLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h2
        className="text-xs font-bold uppercase tracking-[0.2em]"
        style={{ color: accent, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
        {label}
      </h2>
      <span aria-hidden="true" className="flex-1 h-px bg-white/10" />
      <span
        aria-hidden="true"
        className="text-[10px] text-white/30"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
        {String(label.length).padStart(2, '0')}
      </span>
    </div>
  );
}

function MetaItem({ k, v, accent }: { k: string; v: string; accent: string }) {
  return (
    <div className="min-w-0">
      <p
        className="text-[10px] uppercase tracking-[0.16em] text-white/60"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
        {k}
      </p>
      <p className="text-[13px] font-medium mt-1 truncate" style={{ color: accent }}>
        {v}
      </p>
    </div>
  );
}

export default function TechnicalTemplate({
  profile,
  config,
  preferences,
}: TechnicalTemplateProps) {
  const accent = resolveAccent(preferences?.accentKey, config);
  const order = preferences?.sectionOrder?.length
    ? normalizeSectionOrder(preferences.sectionOrder)
    : DEFAULT_ORDER;
  const hidden = new Set(preferences?.hiddenSections ?? []);
  const [showAllExp, setShowAllExp] = useState(false);

  const visibleExps =
    showAllExp || profile.experiences.length <= EXP_COLLAPSE_AT
      ? profile.experiences
      : profile.experiences.slice(0, EXP_COLLAPSE_AT);
  const hiddenExpCount = profile.experiences.length - visibleExps.length;
  const firstYear = profile.experiences.length
    ? Math.min(...profile.experiences.map((e) => e.start_year))
    : null;

  const sectionMap: Record<string, React.ReactNode> = {
    basics: profile.about ? (
      <section key="basics" className="mb-12">
        <SectionLabel label="Profile" accent={accent} />
        <p
          className="text-[15px] leading-[1.75] max-w-[64ch] text-white/85"
          style={{ fontFamily: config.fonts.body }}>
          {profile.about}
        </p>
      </section>
    ) : null,

    projects:
      profile.projects.length > 0 ? (
        <section key="projects" className="mb-12">
          <SectionLabel label="Projects" accent={accent} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.projects.map((proj) => (
              <article
                key={proj.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:border-white/25 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="text-[14px] font-semibold text-white"
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {proj.name}
                  </h3>
                  <span aria-hidden="true" className="text-white/30 text-xs mt-0.5">
                    ↗
                  </span>
                </div>
                {proj.description && (
                  <p className="text-[13px] leading-relaxed mt-2 text-white/60">
                    {proj.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {proj.project_url && (
                    <a
                      href={sanitizeUrl(proj.project_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold px-2 py-0.5 rounded border"
                      style={{
                        color: accent,
                        borderColor: accent + '55',
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      }}>
                      [live]
                    </a>
                  )}
                  {proj.repository_url && (
                    <a
                      href={sanitizeUrl(proj.repository_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold px-2 py-0.5 rounded border border-white/20 text-white/70 hover:border-white/40"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                      [src]
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null,

    experience:
      profile.experiences.length > 0 ? (
        <section key="experience" className="mb-12">
          <SectionLabel label="Experience" accent={accent} />
          <ol className="space-y-6">
            {visibleExps.map((exp) => (
              <li
                key={exp.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-1 sm:gap-4 sm:items-baseline">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-white">{exp.role}</h3>
                  <p className="text-[13px] mt-0.5" style={{ color: accent }}>
                    {exp.company}
                    {exp.location ? <span className="text-white/60"> · {exp.location}</span> : null}
                  </p>
                  {exp.description && (
                    <p className="text-[13px] leading-relaxed mt-1.5 text-white/60 max-w-[64ch]">
                      {exp.description}
                    </p>
                  )}
                </div>
                <span
                  className="text-[11px] tabular-nums text-white/60 sm:text-right"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                  {formatDateRange({
                    startYear: exp.start_year,
                    startMonth: exp.start_month,
                    endYear: exp.end_year,
                    endMonth: exp.end_month,
                    current: exp.is_current,
                  })}
                </span>
              </li>
            ))}
          </ol>
          {hiddenExpCount > 0 && !showAllExp && (
            <button
              type="button"
              onClick={() => setShowAllExp(true)}
              aria-expanded={false}
              className="mt-5 text-[13px] font-semibold underline underline-offset-4 hover:opacity-70"
              style={{ color: accent, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              + show {hiddenExpCount} more
            </button>
          )}
        </section>
      ) : null,

    skills:
      profile.skills.length > 0 ? (
        <section key="skills" className="mb-12">
          <SectionLabel label="Skills" accent={accent} />
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {profile.skills.map((s) => (
              <span
                key={s.id}
                className="text-[13px] text-white/80"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                <span style={{ color: accent }}>·</span> {s.name}
              </span>
            ))}
          </div>
        </section>
      ) : null,

    education:
      profile.education.length > 0 ? (
        <section key="education" className="mb-12">
          <SectionLabel label="Education" accent={accent} />
          <div className="space-y-4">
            {profile.education.map((edu) => (
              <div
                key={edu.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <h3 className="text-[14px] font-semibold text-white">{edu.institution}</h3>
                  <p className="text-[13px] text-white/60">
                    {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ')}
                  </p>
                </div>
                <span
                  className="text-[11px] tabular-nums text-white/60"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
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
        <footer key="links" className="pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {profile.links.map((link) => (
              <a
                key={link.id}
                href={sanitizeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
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
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
        <header className="mb-14 pb-8 border-b border-white/12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.22em] mb-3"
                style={{ color: accent, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                {profile.headline || 'Career profile'}
              </p>
              <h1
                className="font-bold tracking-[-0.02em] leading-[1.05] text-white"
                style={{
                  fontFamily: config.fonts.heading,
                  fontSize: 'clamp(2rem, 1.3rem + 2.4vw, 2.9rem)',
                }}>
                {profile.display_name || profile.username}
              </h1>
            </div>
            {profile.avatar_url && (
              <img
                src={sanitizeUrl(profile.avatar_url)}
                alt={profile.display_name ?? profile.username}
                className="w-16 h-16 rounded-lg object-cover border border-white/15 self-start sm:self-auto"
              />
            )}
          </div>

          <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {profile.location && <MetaItem k="Location" v={profile.location} accent={accent} />}
            {firstYear && <MetaItem k="Experience" v={`Since ${firstYear}`} accent={accent} />}
            {profile.headline && <MetaItem k="Focus" v={profile.headline} accent={accent} />}
          </div>
        </header>

        {order.map((section) =>
          hidden.has(section) ? null : <div key={section}>{sectionMap[section] ?? null}</div>
        )}
      </div>
    </div>
  );
}

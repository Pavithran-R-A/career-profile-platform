import { useState } from 'react';
import {
  normalizeSectionOrder,
  type TemplateConfig,
  type PortfolioProfile,
} from '../../lib/templates/types';
import { sanitizeUrl } from '../../lib/validators/url';
import { formatDateRange } from '../../lib/profiles/date-format';
import { evidenceForProject, evidenceForSkill } from '../../lib/evidence/public';
import { LinkIcon } from '../portfolio/links';
import { ProjectEvidence, SkillEvidence } from '../portfolio/EvidenceAffordance';

interface TemplatePreferences {
  accentKey: string;
  sectionOrder: string[];
  hiddenSections: string[];
}

interface MinimalTemplateProps {
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

function SectionLabel({ children, muted }: { children: React.ReactNode; muted: string }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-5 pb-2 border-b"
      style={{ color: muted, borderColor: muted + '40' }}>
      {children}
    </p>
  );
}

export default function MinimalTemplate({ profile, config, preferences }: MinimalTemplateProps) {
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
        <SectionLabel muted={muted}>About</SectionLabel>
        <p
          className="text-[17px] leading-[1.75] max-w-[62ch]"
          style={{ color: config.colors.text }}>
          {profile.about}
        </p>
      </section>
    ) : null,

    experience:
      profile.experiences.length > 0 ? (
        <section key="experience" className="mb-14">
          <SectionLabel muted={muted}>Experience</SectionLabel>
          <ol className="space-y-8">
            {visibleExps.map((exp) => (
              <li key={exp.id} className="grid grid-cols-1 sm:grid-cols-[168px_1fr] gap-1 sm:gap-6">
                <span className="text-xs font-medium tabular-nums pt-1" style={{ color: muted }}>
                  {formatDateRange({
                    startYear: exp.start_year,
                    startMonth: exp.start_month,
                    endYear: exp.end_year,
                    endMonth: exp.end_month,
                    current: exp.is_current,
                  })}
                </span>
                <div>
                  <h3
                    className="text-[17px] font-semibold leading-snug"
                    style={{ color: config.colors.text }}>
                    {exp.role}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: accent }}>
                    {exp.company}
                    {exp.location ? ` · ${exp.location}` : ''}
                  </p>
                  {exp.description && (
                    <p
                      className="text-sm leading-relaxed mt-2 max-w-[64ch]"
                      style={{ color: muted }}>
                      {exp.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {hiddenExpCount > 0 && !showAllExp && (
            <button
              type="button"
              onClick={() => setShowAllExp(true)}
              aria-expanded={false}
              className="mt-6 text-sm font-medium underline underline-offset-4 hover:opacity-70"
              style={{ color: accent }}>
              Show all {profile.experiences.length} roles ({hiddenExpCount} more)
            </button>
          )}
        </section>
      ) : null,

    projects:
      profile.projects.length > 0 ? (
        <section key="projects" className="mb-14">
          <SectionLabel muted={muted}>Selected work</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profile.projects.map((proj) => {
              const projectEvidence = evidenceForProject(profile.evidence ?? [], proj);
              return (
              <article
                key={proj.id}
                className="rounded-xl border p-5 transition-shadow hover:shadow-[var(--shadow-card)]"
                style={{ borderColor: muted + '35', background: config.colors.background }}>
                <div className="flex items-start justify-between gap-3">
                  <h3
                    className="text-[15px] font-semibold leading-snug"
                    style={{ color: config.colors.text }}>
                    {proj.name}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="text-lg leading-none"
                    style={{ color: accent }}>
                    ↗
                  </span>
                </div>
                {proj.description && (
                  <p className="text-sm leading-relaxed mt-2" style={{ color: muted }}>
                    {proj.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                  {proj.project_url && (
                    <a
                      href={sanitizeUrl(proj.project_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-70"
                      style={{ color: accent }}>
                      View live
                    </a>
                  )}
                  {proj.repository_url && (
                    <a
                      href={sanitizeUrl(proj.repository_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-70"
                      style={{ color: muted }}>
                      Source
                    </a>
                  )}
                </div>
                <ProjectEvidence refs={projectEvidence} mutedColor={muted} />
              </article>
              );
            })}
          </div>
        </section>
      ) : null,

    skills:
      profile.skills.length > 0 ? (
        <section key="skills" className="mb-14">
          <SectionLabel muted={muted}>Skills</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((s) => (
              <span
                key={s.id}
                className="text-[13px] px-3 py-1 rounded-full border inline-flex items-center gap-1.5"
                style={{ borderColor: muted + '40', color: config.colors.text }}>
                {s.name}
                <SkillEvidence ref={evidenceForSkill(profile.evidence ?? [], s.name)} accent={accent} />
              </span>
            ))}
          </div>
        </section>
      ) : null,

    education:
      profile.education.length > 0 ? (
        <section key="education" className="mb-14">
          <SectionLabel muted={muted}>Education</SectionLabel>
          <div className="space-y-5">
            {profile.education.map((edu) => (
              <div
                key={edu.id}
                className="grid grid-cols-1 sm:grid-cols-[168px_1fr] gap-1 sm:gap-6">
                <span className="text-xs font-medium tabular-nums pt-1" style={{ color: muted }}>
                  {formatDateRange({
                    startYear: edu.start_year,
                    startMonth: edu.start_month,
                    endYear: edu.end_year,
                    endMonth: edu.end_month,
                    current: !edu.end_year,
                  })}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold" style={{ color: config.colors.text }}>
                    {edu.institution}
                  </h3>
                  <p className="text-sm" style={{ color: muted }}>
                    {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ')}
                  </p>
                </div>
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
                className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-70"
                style={{ color: muted }}>
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
      <div className="max-w-3xl mx-auto px-7 sm:px-10 py-16 sm:py-24">
        <header className="mb-16">
          {profile.avatar_url && (
            <img
              src={sanitizeUrl(profile.avatar_url)}
              alt={profile.display_name ?? profile.username}
              className="w-20 h-20 rounded-full mb-6 object-cover"
            />
          )}
          <h1
            className="font-semibold tracking-[-0.03em] leading-[1.05]"
            style={{
              fontFamily: config.fonts.heading,
              fontSize: 'clamp(2.1rem, 1.4rem + 2.6vw, 3.1rem)',
              color: config.colors.text,
            }}>
            {profile.display_name || profile.username}
          </h1>
          {profile.headline && (
            <p className="mt-3 text-lg" style={{ color: accent }}>
              {profile.headline}
            </p>
          )}
          <div
            className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
            style={{ color: muted }}>
            {profile.location && <span>{profile.location}</span>}
            {profile.links.slice(0, 3).map((link) => (
              <a
                key={link.id}
                href={sanitizeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:opacity-70"
                style={{ color: muted }}>
                <LinkIcon label={link.label} url={link.url} size={14} />
                {link.label}
              </a>
            ))}
          </div>
        </header>

        {order.map((section) =>
          hidden.has(section) ? null : <div key={section}>{sectionMap[section] ?? null}</div>
        )}
      </div>
    </div>
  );
}

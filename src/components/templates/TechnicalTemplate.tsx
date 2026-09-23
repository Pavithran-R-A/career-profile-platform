import type { ProfileWithRelations } from '../../lib/profiles/repository';
import type { TemplateConfig } from '../../lib/templates/types';
import { sanitizeUrl } from '../../lib/validators/url';

interface TemplatePreferences {
  accentKey: string;
  sectionOrder: string[];
  hiddenSections: string[];
}

interface TechnicalTemplateProps {
  profile: ProfileWithRelations;
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

const DEFAULT_ORDER = ['basics', 'experience', 'education', 'projects', 'skills', 'links'];

function resolveAccent(accentKey: string | undefined, config: TemplateConfig): string {
  return ACCENT_COLORS[accentKey ?? ''] ?? config.colors.accent;
}

export default function TechnicalTemplate({
  profile,
  config,
  preferences,
}: TechnicalTemplateProps) {
  const accent = resolveAccent(preferences?.accentKey, config);
  const order = preferences?.sectionOrder?.length ? preferences.sectionOrder : DEFAULT_ORDER;
  const hidden = new Set(preferences?.hiddenSections ?? []);

  const sectionMap: Record<string, React.ReactNode> = {
    basics: profile.about ? (
      <section key="basics" className="mb-8">
        <p className="text-xs mt-4 leading-relaxed" style={{ color: config.colors.muted }}>
          {profile.about}
        </p>
      </section>
    ) : null,

    experience:
      profile.experiences.length > 0 ? (
        <section key="experience" className="mb-8">
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: accent }}>
            &gt; experience
          </h2>
          <div className="space-y-5 ml-4 border-l-2 pl-4" style={{ borderColor: accent + '30' }}>
            {profile.experiences.map((exp) => (
              <div key={exp.id} className="relative">
                <div
                  className="absolute w-2 h-2 rounded-full -left-[23px] top-1.5"
                  style={{ backgroundColor: accent }}
                />
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold">{exp.role}</span>
                  <span className="text-[10px]" style={{ color: config.colors.muted }}>
                    {exp.start_year}–{exp.end_year ?? 'now'}
                  </span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: config.colors.muted }}>
                  {exp.company}
                  {exp.location && ` | ${exp.location}`}
                </p>
                {exp.description && (
                  <p className="text-xs mt-1" style={{ color: config.colors.muted }}>
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null,

    education:
      profile.education.length > 0 ? (
        <section key="education" className="mb-8">
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: accent }}>
            &gt; education
          </h2>
          <div className="space-y-3 ml-4">
            {profile.education.map((edu) => (
              <div key={edu.id}>
                <span className="text-xs font-bold">{edu.institution}</span>
                {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ') && (
                  <p className="text-[11px] mt-0.5" style={{ color: config.colors.muted }}>
                    {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null,

    projects:
      profile.projects.length > 0 ? (
        <section key="projects" className="mb-8">
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: accent }}>
            &gt; projects
          </h2>
          <div className="space-y-3 ml-4">
            {profile.projects.map((proj) => (
              <div key={proj.id}>
                <span className="text-xs font-bold">{proj.name}</span>
                {proj.description && (
                  <p className="text-[11px] mt-0.5" style={{ color: config.colors.muted }}>
                    {proj.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null,

    skills:
      profile.skills.length > 0 ? (
        <section key="skills" className="mb-8">
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: accent }}>
            &gt; skills
          </h2>
          <div className="ml-4 text-xs" style={{ color: config.colors.muted }}>
            {profile.skills.map((s) => s.name).join(' · ')}
          </div>
        </section>
      ) : null,

    links:
      profile.links.length > 0 ? (
        <footer
          key="links"
          className="pt-6 border-t text-[11px]"
          style={{ borderColor: accent + '30' }}>
          <div className="flex flex-wrap gap-3">
            {profile.links.map((link) => (
              <a
                key={link.id}
                href={sanitizeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: accent }}>
                [{link.label}]
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
        fontFamily: config.fonts.mono,
      }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10 pb-6 border-b-2" style={{ borderColor: accent }}>
          <div className="flex items-start gap-6">
            {profile.avatar_url && (
              <img
                src={sanitizeUrl(profile.avatar_url)}
                alt={profile.display_name ?? profile.username}
                className="w-16 h-16 rounded object-cover"
              />
            )}
            <div>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: config.fonts.heading, color: accent }}>
                {profile.display_name || profile.username}
              </h1>
              {profile.headline && (
                <p className="text-xs mt-1" style={{ color: accent }}>
                  {profile.headline}
                </p>
              )}
              {profile.location && (
                <p className="text-xs mt-1" style={{ color: config.colors.muted }}>
                  {profile.location}
                </p>
              )}
            </div>
          </div>
        </header>

        {order.map((section) =>
          hidden.has(section) ? null : <div key={section}>{sectionMap[section] ?? null}</div>
        )}
      </div>
    </div>
  );
}

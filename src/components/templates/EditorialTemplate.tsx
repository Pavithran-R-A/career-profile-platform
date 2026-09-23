import type { ProfileWithRelations } from '../../lib/profiles/repository';
import type { TemplateConfig } from '../../lib/templates/types';
import { sanitizeUrl } from '../../lib/validators/url';

interface TemplatePreferences {
  accentKey: string;
  sectionOrder: string[];
  hiddenSections: string[];
}

interface EditorialTemplateProps {
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
    <h2
      className="text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
      style={{
        color: accent,
        borderColor: config.colors.muted + '40',
        fontFamily: config.fonts.heading,
      }}>
      {label}
    </h2>
  );
}

export default function EditorialTemplate({
  profile,
  config,
  preferences,
}: EditorialTemplateProps) {
  const accent = resolveAccent(preferences?.accentKey, config);
  const order = preferences?.sectionOrder?.length ? preferences.sectionOrder : DEFAULT_ORDER;
  const hidden = new Set(preferences?.hiddenSections ?? []);

  const sectionMap: Record<string, React.ReactNode> = {
    basics: profile.about ? (
      <section key="basics">
        <p className="text-sm leading-relaxed max-w-lg">{profile.about}</p>
      </section>
    ) : null,

    experience:
      profile.experiences.length > 0 ? (
        <section key="experience">
          <SectionHeading label="Experience" accent={accent} config={config} />
          <div className="space-y-6">
            {profile.experiences.map((exp) => (
              <div key={exp.id}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">{exp.role}</h3>
                  <span className="text-xs" style={{ color: config.colors.muted }}>
                    {exp.start_year} – {exp.end_year ?? 'Present'}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: config.colors.muted }}>
                  {exp.company}
                  {exp.location && ` · ${exp.location}`}
                </p>
                {exp.description && (
                  <p className="text-sm mt-2 leading-relaxed">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null,

    education:
      profile.education.length > 0 ? (
        <section key="education">
          <SectionHeading label="Education" accent={accent} config={config} />
          <div className="space-y-4">
            {profile.education.map((edu) => (
              <div key={edu.id}>
                <h3 className="text-sm font-semibold">{edu.institution}</h3>
                {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ') && (
                  <p className="text-xs mt-0.5" style={{ color: config.colors.muted }}>
                    {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ')}
                  </p>
                )}
                {edu.description && <p className="text-sm mt-1">{edu.description}</p>}
              </div>
            ))}
          </div>
        </section>
      ) : null,

    projects:
      profile.projects.length > 0 ? (
        <section key="projects">
          <SectionHeading label="Projects" accent={accent} config={config} />
          <div className="space-y-4">
            {profile.projects.map((proj) => (
              <div key={proj.id}>
                <h3 className="text-sm font-semibold">{proj.name}</h3>
                {proj.description && (
                  <p className="text-xs mt-0.5" style={{ color: config.colors.muted }}>
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
        <section key="skills">
          <SectionHeading label="Skills" accent={accent} config={config} />
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span
                key={skill.id}
                className="text-xs px-3 py-1 rounded"
                style={{
                  backgroundColor: accent + '10',
                  color: accent,
                }}>
                {skill.name}
              </span>
            ))}
          </div>
        </section>
      ) : null,

    links:
      profile.links.length > 0 ? (
        <section key="links">
          <SectionHeading label="Links" accent={accent} config={config} />
          <div className="flex flex-wrap gap-3">
            {profile.links.map((link) => (
              <a
                key={link.id}
                href={sanitizeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ color: accent }}>
                {link.label}
              </a>
            ))}
          </div>
        </section>
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
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-screen">
        <aside className="px-8 py-12" style={{ backgroundColor: accent + '0A' }}>
          <div className="sticky top-12">
            {profile.avatar_url && (
              <img
                src={sanitizeUrl(profile.avatar_url)}
                alt={profile.display_name ?? profile.username}
                className="w-20 h-20 rounded-lg mb-4 object-cover"
              />
            )}
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: config.fonts.heading, color: accent }}>
              {profile.display_name || profile.username}
            </h1>
            {profile.headline && (
              <p className="mt-1 text-sm" style={{ color: config.colors.muted }}>
                {profile.headline}
              </p>
            )}
            {profile.location && (
              <p className="mt-2 text-xs" style={{ color: config.colors.muted }}>
                {profile.location}
              </p>
            )}
          </div>
        </aside>

        <main className="px-8 py-12 space-y-10">
          {order.map((section) =>
            hidden.has(section) ? null : <div key={section}>{sectionMap[section] ?? null}</div>
          )}
        </main>
      </div>
    </div>
  );
}

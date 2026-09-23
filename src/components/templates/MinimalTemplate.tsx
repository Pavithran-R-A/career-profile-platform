import type { ProfileWithRelations } from '../../lib/profiles/repository';
import type { TemplateConfig } from '../../lib/templates/types';
import { sanitizeUrl } from '../../lib/validators/url';

interface TemplatePreferences {
  accentKey: string;
  sectionOrder: string[];
  hiddenSections: string[];
}

interface MinimalTemplateProps {
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

const DEFAULT_ORDER = ['basics', 'experience', 'education', 'skills', 'projects', 'links'];

function resolveAccent(accentKey: string | undefined, config: TemplateConfig): string {
  return ACCENT_COLORS[accentKey ?? ''] ?? config.colors.accent;
}

function renderBasics(profile: ProfileWithRelations) {
  if (!profile.about) return null;
  return (
    <section className="mb-10">
      <p className="text-sm leading-relaxed max-w-xl">{profile.about}</p>
    </section>
  );
}

function renderExperience(profile: ProfileWithRelations, config: TemplateConfig, accent: string) {
  if (profile.experiences.length === 0) return null;
  return (
    <section className="mb-10">
      {profile.experiences.map((exp) => (
        <div key={exp.id} className="mb-6">
          <div className="flex justify-between items-baseline">
            <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: accent }}>
              {exp.role}
            </h2>
            <span className="text-xs" style={{ color: config.colors.muted }}>
              {exp.start_year} – {exp.end_year ?? 'Present'}
            </span>
          </div>
          <p className="text-sm mt-1">{exp.company}</p>
          {exp.description && (
            <p className="text-sm mt-1" style={{ color: config.colors.muted }}>
              {exp.description}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

function renderEducation(profile: ProfileWithRelations, config: TemplateConfig) {
  if (profile.education.length === 0) return null;
  return (
    <section className="mb-10">
      {profile.education.map((edu) => (
        <div key={edu.id} className="mb-4">
          <h2 className="text-sm font-medium">{edu.institution}</h2>
          {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ') && (
            <p className="text-xs mt-0.5" style={{ color: config.colors.muted }}>
              {[edu.degree, edu.field_of_study].filter(Boolean).join(' — ')}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

function renderSkills(profile: ProfileWithRelations, accent: string) {
  if (profile.skills.length === 0) return null;
  return (
    <section className="mb-10">
      <p className="text-sm" style={{ color: accent }}>
        {profile.skills.map((s) => s.name).join(' / ')}
      </p>
    </section>
  );
}

function renderProjects(profile: ProfileWithRelations, config: TemplateConfig) {
  if (profile.projects.length === 0) return null;
  return (
    <section className="mb-10">
      {profile.projects.map((proj) => (
        <div key={proj.id} className="mb-4">
          <h2 className="text-sm font-medium">{proj.name}</h2>
          {proj.description && (
            <p className="text-xs mt-0.5" style={{ color: config.colors.muted }}>
              {proj.description}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

function renderLinks(profile: ProfileWithRelations, config: TemplateConfig) {
  if (profile.links.length === 0) return null;
  return (
    <footer className="pt-6 border-t" style={{ borderColor: config.colors.muted }}>
      <div className="flex flex-wrap gap-4">
        {profile.links.map((link) => (
          <a
            key={link.id}
            href={sanitizeUrl(link.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: config.colors.muted }}>
            {link.label}
          </a>
        ))}
      </div>
    </footer>
  );
}

export default function MinimalTemplate({ profile, config, preferences }: MinimalTemplateProps) {
  const accent = resolveAccent(preferences?.accentKey, config);
  const order = preferences?.sectionOrder?.length ? preferences.sectionOrder : DEFAULT_ORDER;
  const hidden = new Set(preferences?.hiddenSections ?? []);

  const sectionMap: Record<string, React.ReactNode> = {
    basics: renderBasics(profile),
    experience: renderExperience(profile, config, accent),
    education: renderEducation(profile, config),
    skills: renderSkills(profile, accent),
    projects: renderProjects(profile, config),
    links: renderLinks(profile, config),
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: config.colors.background,
        color: config.colors.text,
        fontFamily: config.fonts.body,
      }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-12">
          {profile.avatar_url && (
            <img
              src={sanitizeUrl(profile.avatar_url)}
              alt={profile.display_name ?? profile.username}
              className="w-16 h-16 rounded-full mb-4 object-cover"
            />
          )}
          <h1
            className="text-3xl font-light tracking-tight"
            style={{ fontFamily: config.fonts.heading, color: accent }}>
            {profile.display_name || profile.username}
          </h1>
          {profile.headline && (
            <p className="mt-2 text-sm" style={{ color: config.colors.muted }}>
              {profile.headline}
            </p>
          )}
          {profile.location && (
            <p className="mt-1 text-xs" style={{ color: config.colors.muted }}>
              {profile.location}
            </p>
          )}
        </header>

        {order.map((section) =>
          hidden.has(section) ? null : <div key={section}>{sectionMap[section] ?? null}</div>
        )}
      </div>
    </div>
  );
}

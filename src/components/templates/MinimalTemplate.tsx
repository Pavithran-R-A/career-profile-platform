import type { ProfileWithRelations } from '../../lib/profiles/repository';
import type { TemplateConfig } from '../../lib/templates/types';

interface MinimalTemplateProps {
  profile: ProfileWithRelations;
  config: TemplateConfig;
}

export default function MinimalTemplate({ profile, config }: MinimalTemplateProps) {
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
              src={profile.avatar_url}
              alt={profile.display_name ?? profile.username}
              className="w-16 h-16 rounded-full mb-4 object-cover"
            />
          )}
          <h1
            className="text-3xl font-light tracking-tight"
            style={{ fontFamily: config.fonts.heading }}>
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
          {profile.about && (
            <p className="mt-4 text-sm leading-relaxed max-w-xl">{profile.about}</p>
          )}
        </header>

        {profile.experiences.length > 0 && (
          <section className="mb-10">
            {profile.experiences.map((exp) => (
              <div key={exp.id} className="mb-6">
                <div className="flex justify-between items-baseline">
                  <h2
                    className="text-sm font-medium uppercase tracking-wider"
                    style={{ color: config.colors.muted }}>
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
        )}

        {profile.education.length > 0 && (
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
        )}

        {profile.skills.length > 0 && (
          <section className="mb-10">
            <p className="text-sm" style={{ color: config.colors.muted }}>
              {profile.skills.map((s) => s.name).join(' / ')}
            </p>
          </section>
        )}

        {profile.projects.length > 0 && (
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
        )}

        {profile.links.length > 0 && (
          <footer className="pt-6 border-t" style={{ borderColor: config.colors.muted }}>
            <div className="flex flex-wrap gap-4">
              {profile.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline"
                  style={{ color: config.colors.muted }}>
                  {link.label}
                </a>
              ))}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

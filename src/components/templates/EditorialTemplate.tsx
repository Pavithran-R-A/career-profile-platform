import type { ProfileWithRelations } from '../../lib/profiles/repository';
import type { TemplateConfig } from '../../lib/templates/types';

interface EditorialTemplateProps {
  profile: ProfileWithRelations;
  config: TemplateConfig;
}

export default function EditorialTemplate({ profile, config }: EditorialTemplateProps) {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: config.colors.background,
        color: config.colors.text,
        fontFamily: config.fonts.body,
      }}>
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-screen">
        <aside className="px-8 py-12" style={{ backgroundColor: config.colors.primary + '0A' }}>
          <div className="sticky top-12">
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? profile.username}
                className="w-20 h-20 rounded-lg mb-4 object-cover"
              />
            )}
            <h1 className="text-2xl font-bold" style={{ fontFamily: config.fonts.heading }}>
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

            {profile.links.length > 0 && (
              <div className="mt-8 space-y-2">
                {profile.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs underline"
                    style={{ color: config.colors.primary }}>
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="px-8 py-12 space-y-10">
          {profile.about && (
            <section>
              <p className="text-sm leading-relaxed max-w-lg">{profile.about}</p>
            </section>
          )}

          {profile.experiences.length > 0 && (
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
                style={{
                  color: config.colors.primary,
                  borderColor: config.colors.muted + '40',
                  fontFamily: config.fonts.heading,
                }}>
                Experience
              </h2>
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
          )}

          {profile.education.length > 0 && (
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
                style={{
                  color: config.colors.primary,
                  borderColor: config.colors.muted + '40',
                  fontFamily: config.fonts.heading,
                }}>
                Education
              </h2>
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
          )}

          {profile.projects.length > 0 && (
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
                style={{
                  color: config.colors.primary,
                  borderColor: config.colors.muted + '40',
                  fontFamily: config.fonts.heading,
                }}>
                Projects
              </h2>
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
          )}

          {profile.skills.length > 0 && (
            <section>
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b"
                style={{
                  color: config.colors.primary,
                  borderColor: config.colors.muted + '40',
                  fontFamily: config.fonts.heading,
                }}>
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="text-xs px-3 py-1 rounded"
                    style={{
                      backgroundColor: config.colors.primary + '10',
                      color: config.colors.primary,
                    }}>
                    {skill.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

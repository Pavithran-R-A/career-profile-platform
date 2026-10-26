interface ATSResumeData {
  profileId: string;
  displayName: string;
  headline: string | null;
  location: string | null;
  about: string | null;
  experiences: Array<{
    role: string;
    company: string;
    location: string | null;
    startYear: number;
    endYear: number | null;
    isCurrent: boolean;
    description: string | null;
  }>;
  education: Array<{
    institution: string;
    degree: string | null;
    fieldOfStudy: string | null;
  }>;
  skills: string[];
  projects: Array<{
    name: string;
    description: string | null;
  }>;
  links: Array<{
    label: string;
    url: string;
  }>;
}

interface ATSPreviewProps {
  data: ATSResumeData;
}

export default function ATSPreview({ data }: ATSPreviewProps) {
  return (
    <div
      id="ats-resume-preview"
      className="bg-white text-gray-900 p-8 max-w-[8.5in] mx-auto"
      style={{ fontFamily: 'Georgia, serif' }}>
      <header className="mb-6 pb-4 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-wide">{data.displayName}</h1>
        {data.headline && <p className="text-sm text-gray-600 mt-1">{data.headline}</p>}
        {data.location && <p className="text-xs text-gray-500 mt-1">{data.location}</p>}
        {data.links.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
            {data.links.map((link, i) => (
              <span key={i}>
                {link.label}: {link.url}
              </span>
            ))}
          </div>
        )}
      </header>

      {data.about && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            Professional Summary
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">{data.about}</p>
        </section>
      )}

      {data.experiences.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Experience
          </h2>
          <div className="space-y-4">
            {data.experiences.map((exp, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold">{exp.role}</span>
                  <span className="text-xs text-gray-500">
                    {exp.startYear} – {exp.isCurrent ? 'Present' : (exp.endYear ?? '')}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {exp.company}
                  {exp.location && ` · ${exp.location}`}
                </p>
                {exp.description && (
                  <p className="text-xs mt-1 leading-relaxed whitespace-pre-line">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.education.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Education
          </h2>
          <div className="space-y-2">
            {data.education.map((edu, i) => (
              <div key={i}>
                <p className="text-sm font-bold">{edu.institution}</p>
                {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(' — ') && (
                  <p className="text-xs text-gray-600">
                    {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(' — ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.skills.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Skills</h2>
          <p className="text-xs leading-relaxed">{data.skills.join(' · ')}</p>
        </section>
      )}

      {data.projects.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Projects
          </h2>
          <div className="space-y-2">
            {data.projects.map((proj, i) => (
              <div key={i}>
                <p className="text-sm font-bold">{proj.name}</p>
                {proj.description && (
                  <p className="text-xs text-gray-600 mt-0.5">{proj.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
        <p>This resume is ATS-optimized: plain text, no tables, no graphics, standard headings.</p>
      </div>
    </div>
  );
}

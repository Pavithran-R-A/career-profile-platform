import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { sanitizeUrl } from '../lib/validators/url';
import { toATSExportModel } from '../lib/resume/ats-export';
import { generatePDFBlob } from '../lib/resume/pdf-renderer';
import { buildATSViewModel } from '../lib/resume/ats-view-model';
import ATSPreview from '../components/ATSPreview';
import ATSGuidance from '../components/ATSGuidance';
import { ScaledCanvas } from '../components/marketing/BrowserFrame';
import { useNoindexMeta } from '../lib/seo/usePageMeta';
import { track } from '../lib/analytics/events';
import type { ProfileWithRelations } from '../lib/profiles/repository';

type BuilderState = 'idle' | 'loading' | 'ready' | 'generating' | 'preview' | 'error';

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

function buildATSData(profile: ProfileWithRelations): ATSResumeData {
  return {
    profileId: profile.id,
    displayName: profile.display_name || profile.username,
    headline: profile.headline,
    location: profile.location,
    about: profile.about,
    experiences: profile.experiences.map((exp) => ({
      role: exp.role,
      company: exp.company,
      location: exp.location,
      startYear: exp.start_year,
      endYear: exp.end_year,
      isCurrent: exp.is_current,
      description: exp.description,
    })),
    education: profile.education.map((edu) => ({
      institution: edu.institution,
      degree: edu.degree,
      fieldOfStudy: edu.field_of_study,
    })),
    skills: profile.skills.map((s) => s.name),
    projects: profile.projects.map((proj) => ({
      name: proj.name,
      description: proj.description,
    })),
    links: profile.links.map((link) => ({
      label: link.label,
      url: link.url,
    })),
  };
}

export default function ATSResumeBuilder() {
  useNoindexMeta('ATS resume — Career Profile');
  const auth = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<BuilderState>('loading');
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [atsData, setAtsData] = useState<ATSResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<
    'identity' | 'experience' | 'education' | 'skills' | 'projects' | 'links'
  >('identity');
  const [headlineOverride, setHeadlineOverride] = useState('');
  const [aboutOverride, setAboutOverride] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedExps, setSelectedExps] = useState<Set<number>>(new Set());
  const [selectedEdus, setSelectedEdus] = useState<Set<number>>(new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        if (p) {
          setProfile(p);
          const data = buildATSData(p);
          setAtsData(data);
          setHeadlineOverride(p.headline || '');
          setAboutOverride(p.about || '');
          setSelectedSkills(new Set(data.skills));
          setSelectedExps(new Set(data.experiences.map((_, i) => i)));
          setSelectedEdus(new Set(data.education.map((_, i) => i)));
          setSelectedProjects(new Set(data.projects.map((_, i) => i)));
          setState('ready');
        } else {
          void navigate('/onboarding');
        }
      });
    }
  }, [auth, navigate]);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      void navigate('/login');
    }
  }, [auth, navigate]);

  const toggleSkill = (skill: string) => {
    const next = new Set(selectedSkills);
    if (next.has(skill)) {
      next.delete(skill);
    } else {
      next.add(skill);
    }
    setSelectedSkills(next);
  };

  const toggleExp = (index: number) => {
    const next = new Set(selectedExps);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedExps(next);
  };

  const toggleEdu = (index: number) => {
    const next = new Set(selectedEdus);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedEdus(next);
  };

  const toggleProject = (index: number) => {
    const next = new Set(selectedProjects);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedProjects(next);
  };

  const handleGenerate = () => {
    if (!atsData) return;
    setState('generating');

    const filteredData: ATSResumeData = {
      ...atsData,
      headline: headlineOverride || atsData.headline,
      about: aboutOverride || atsData.about,
      experiences: atsData.experiences.filter((_, i) => selectedExps.has(i)),
      education: atsData.education.filter((_, i) => selectedEdus.has(i)),
      skills: atsData.skills.filter((s) => selectedSkills.has(s)),
      projects: atsData.projects.filter((_, i) => selectedProjects.has(i)),
    };

    setAtsData(filteredData);
    setState('preview');
    track('ats_generated', { source: 'ats_builder' });
  };

  const handleExportPDF = async () => {
    if (!profile) return;
    setState('generating');
    setError(null);
    try {
      const model = toATSExportModel(profile, {
        headline: headlineOverride,
        summary: aboutOverride,
        email: contactEmail,
        phone: contactPhone,
        selectedSkills,
        selectedExperiences: selectedExps,
        selectedEducation: selectedEdus,
        selectedProjects,
      });
      const blob = await generatePDFBlob(model);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${profile.username}-resume.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      track('ats_downloaded', { source: 'ats_builder' });
      setState('preview');
    } catch {
      setError('Could not generate the PDF. Please try again.');
      setState('preview');
    }
  };

  if (auth.status === 'unauthenticated') {
    return null;
  }

  if (auth.status === 'loading' || state === 'loading') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const sections: { id: typeof activeSection; label: string }[] = [
    { id: 'identity', label: 'Basics' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Skills' },
    { id: 'projects', label: 'Projects' },
    { id: 'links', label: 'Links' },
  ];

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="page-title">ATS resume</h1>
          <p className="page-subtitle">
            A plain, parseable PDF built from your profile — no graphics that break parsers.
          </p>
        </div>
        <button onClick={() => void navigate('/dashboard')} className="link-quiet text-sm">
          ← Back to dashboard
        </button>
      </div>

      <div className="alert alert-info mb-6 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          <strong>Included:</strong> {atsData?.experiences.length ?? 0}{' '}
          {(atsData?.experiences.length ?? 0) === 1 ? 'role' : 'roles'} ·{' '}
          {atsData?.education.length ?? 0}{' '}
          {(atsData?.education.length ?? 0) === 1 ? 'entry' : 'entries'} ·{' '}
          {atsData?.skills.length ?? 0} skills · {atsData?.projects.length ?? 0}{' '}
          {(atsData?.projects.length ?? 0) === 1 ? 'project' : 'projects'}
        </span>
        <span className="text-xs opacity-80">
          Deselect anything you don&apos;t want included, then generate.
        </span>
      </div>

      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6"
          role="alert">
          {error}
        </div>
      )}

      {state === 'generating' && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating ATS-friendly resume...</p>
        </div>
      )}

      {(state === 'ready' || state === 'preview') && atsData && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-[380px] flex-shrink-0 space-y-5">
            <nav aria-label="Resume sections">
              <ul className="space-y-1">
                {sections.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      aria-current={activeSection === section.id ? 'page' : undefined}
                      className={`side-nav-link ${activeSection === section.id ? 'side-nav-link-active' : ''}`}>
                      {section.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-6">
              {activeSection === 'identity' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Basic Information</h2>
                  <div>
                    <label className="block text-sm font-medium mb-1">Display Name</label>
                    <input
                      type="text"
                      value={atsData.displayName}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Headline</label>
                    <input
                      type="text"
                      value={headlineOverride}
                      onChange={(e) => setHeadlineOverride(e.target.value)}
                      placeholder="e.g., Senior Software Engineer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">About / Summary</label>
                    <textarea
                      value={aboutOverride}
                      onChange={(e) => setAboutOverride(e.target.value)}
                      rows={4}
                      placeholder="Brief professional summary for ATS..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="resume-email" className="block text-sm font-medium mb-1">
                      Contact email (optional; never taken from your sign-in account)
                    </label>
                    <input
                      id="resume-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="resume-phone" className="block text-sm font-medium mb-1">
                      Contact phone (optional)
                    </label>
                    <input
                      id="resume-phone"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}

              {activeSection === 'experience' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Experience</h2>
                  {atsData.experiences.length === 0 ? (
                    <p className="text-gray-500">No experience entries found.</p>
                  ) : (
                    <div className="space-y-3">
                      {atsData.experiences.map((exp, index) => (
                        <label
                          key={index}
                          className="flex items-start gap-3 border border-gray-200 rounded-lg p-4">
                          <input
                            type="checkbox"
                            checked={selectedExps.has(index)}
                            onChange={() => toggleExp(index)}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium">{exp.role}</p>
                            <p className="text-sm text-gray-600">
                              {exp.company}
                              {exp.location && ` · ${exp.location}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              {exp.startYear} – {exp.isCurrent ? 'Present' : (exp.endYear ?? 'N/A')}
                            </p>
                            {exp.description && (
                              <p className="text-sm text-gray-600 mt-1">{exp.description}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'education' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Education</h2>
                  {atsData.education.length === 0 ? (
                    <p className="text-gray-500">No education entries found.</p>
                  ) : (
                    <div className="space-y-3">
                      {atsData.education.map((edu, index) => (
                        <label
                          key={index}
                          className="flex items-start gap-3 border border-gray-200 rounded-lg p-4">
                          <input
                            type="checkbox"
                            checked={selectedEdus.has(index)}
                            onChange={() => toggleEdu(index)}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium">{edu.institution}</p>
                            <p className="text-sm text-gray-600">
                              {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(' — ')}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'skills' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Skills</h2>
                  {atsData.skills.length === 0 ? (
                    <p className="text-gray-500">No skills found.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {atsData.skills.map((skill) => (
                        <button
                          key={skill}
                          onClick={() => toggleSkill(skill)}
                          className={`px-3 py-1 rounded-full text-sm border ${
                            selectedSkills.has(skill)
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}>
                          {skill}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'projects' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Projects</h2>
                  {atsData.projects.length === 0 ? (
                    <p className="text-gray-500">No projects found.</p>
                  ) : (
                    <div className="space-y-3">
                      {atsData.projects.map((proj, index) => (
                        <label
                          key={index}
                          className="flex items-start gap-3 border border-gray-200 rounded-lg p-4">
                          <input
                            type="checkbox"
                            checked={selectedProjects.has(index)}
                            onChange={() => toggleProject(index)}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium">{proj.name}</p>
                            {proj.description && (
                              <p className="text-sm text-gray-600">{proj.description}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'links' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Links</h2>
                  {atsData.links.length === 0 ? (
                    <p className="text-gray-500">No links found.</p>
                  ) : (
                    <div className="space-y-2">
                      {atsData.links.map((link, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{link.label}:</span>
                          <a
                            href={sanitizeUrl(link.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline">
                            {link.url}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border)]">
                <button onClick={handleGenerate} className="btn btn-primary flex-1">
                  Generate ATS Preview
                </button>
                {state === 'preview' && (
                  <button
                    onClick={() => void handleExportPDF()}
                    className="btn btn-secondary flex-1">
                    Export PDF
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dominant preview + guidance */}
          <div className="flex-1 min-w-0 space-y-5">
            {profile && state === 'ready' && (
              <ATSGuidance
                viewModel={buildATSViewModel(
                  {
                    id: profile.id,
                    userId: auth.user.id,
                    createdAt: profile.created_at,
                    updatedAt: profile.updated_at,
                    preferences: {
                      username: profile.username,
                      visibility: profile.visibility,
                      showEmail: true,
                    },
                    identity: {
                      fullName: profile.display_name || profile.username,
                      headline: profile.headline || '',
                      location: profile.location,
                      avatarUrl: profile.avatar_url,
                    },
                    about: profile.about,
                    links: profile.links.map(({ label, url }) => ({ label, url })),
                    experiences: profile.experiences.map((exp) => ({
                      id: exp.id,
                      role: exp.role,
                      company: exp.company,
                      location: exp.location,
                      startDate: String(exp.start_year),
                      endDate: exp.is_current ? null : exp.end_year ? String(exp.end_year) : null,
                      description: exp.description || '',
                    })),
                    education: profile.education.map((edu) => ({
                      id: edu.id,
                      degree: edu.degree || '',
                      institution: edu.institution,
                      field: edu.field_of_study,
                      startDate: edu.start_year ? String(edu.start_year) : '',
                      endDate: edu.end_year ? String(edu.end_year) : null,
                    })),
                    skills: profile.skills.map((s) => ({ name: s.name, evidenceCount: 0 })),
                    projects: profile.projects.map((proj) => ({
                      id: proj.id,
                      name: proj.name,
                      description: proj.description || '',
                      url: proj.project_url,
                      repoUrl: proj.repository_url,
                      technologies: [],
                    })),
                  },
                  {
                    email: contactEmail || null,
                    phone: contactPhone || null,
                    showEmail: true,
                    showPhone: true,
                  }
                )}
              />
            )}
            <div className="lg:sticky lg:top-24">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
                  Resume preview
                </p>
                {state === 'preview' && (
                  <span className="status-chip status-chip-live">Ready to export</span>
                )}
              </div>
              {state === 'preview' ? (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-warm)]">
                    <span className="w-2 h-2 rounded-full bg-[#ff5f57]" aria-hidden="true" />
                    <span className="w-2 h-2 rounded-full bg-[#febc2e]" aria-hidden="true" />
                    <span className="w-2 h-2 rounded-full bg-[#28c840]" aria-hidden="true" />
                    <span className="ml-1.5 text-[10px] text-[var(--faint-foreground)] truncate">
                      {profile?.username ?? 'you'}-resume.pdf
                    </span>
                  </div>
                  <ScaledCanvas scale={0.72} height={600} label="ATS resume preview">
                    <ATSPreview data={atsData} />
                  </ScaledCanvas>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-warm)] p-10 text-center">
                  <svg
                    className="mx-auto w-10 h-10 text-[var(--faint-foreground)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6M9 17h6"
                    />
                  </svg>
                  <p className="text-sm font-semibold text-[var(--ink)] mt-4">
                    Your resume preview appears here
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1.5 max-w-[36ch] mx-auto leading-relaxed">
                    Choose the sections you want, add contact details, then generate a preview.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={() => {
              setState('loading');
              setError(null);
              void profileService.getProfile(auth.user!.id).then((p) => {
                if (p) {
                  setProfile(p);
                  setAtsData(buildATSData(p));
                  setState('ready');
                }
              });
            }}
            className="bg-gray-900 text-white py-2 px-6 rounded-md hover:bg-gray-800">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

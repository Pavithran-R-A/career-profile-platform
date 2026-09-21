import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import type { ProfileWithRelations } from '../lib/profiles/repository';

export default function DashboardPreview() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        setProfile(p);
        setLoading(false);
      });
    }
  }, [auth]);

  if (auth.status !== 'authenticated') {
    void navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!profile) {
    void navigate('/onboarding');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Preview</h1>
          <div className="flex gap-4">
            <button
              onClick={() => void navigate('/dashboard/profile')}
              className="text-sm text-gray-600 hover:text-gray-900">
              Edit profile
            </button>
            <button
              onClick={() => void navigate('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-900">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">{profile.display_name || profile.username}</h2>
            {profile.headline && <p className="text-gray-600 mt-1">{profile.headline}</p>}
            {profile.location && <p className="text-sm text-gray-500 mt-1">{profile.location}</p>}
          </div>

          {profile.about && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">About</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{profile.about}</p>
            </div>
          )}

          {profile.experiences.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Experience</h3>
              <div className="space-y-4">
                {profile.experiences.map((exp) => (
                  <div key={exp.id} className="border-l-2 border-gray-200 pl-4">
                    <h4 className="font-medium">{exp.role}</h4>
                    <p className="text-gray-600">{exp.company}</p>
                    <p className="text-sm text-gray-500">
                      {exp.start_year} - {exp.is_current ? 'Present' : exp.end_year}
                    </p>
                    {exp.description && (
                      <p className="text-sm text-gray-600 mt-2">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.education.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Education</h3>
              <div className="space-y-4">
                {profile.education.map((edu) => (
                  <div key={edu.id} className="border-l-2 border-gray-200 pl-4">
                    <h4 className="font-medium">{edu.institution}</h4>
                    <p className="text-gray-600">{edu.degree || 'Degree'}</p>
                    <p className="text-sm text-gray-500">
                      {edu.start_year} - {edu.end_year || 'Present'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.skills.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.projects.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Projects</h3>
              <div className="space-y-4">
                {profile.projects.map((project) => (
                  <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium">{project.name}</h4>
                    {project.description && (
                      <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-sm">
                      {project.project_url && (
                        <a
                          href={project.project_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">
                          Live
                        </a>
                      )}
                      {project.repository_url && (
                        <a
                          href={project.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">
                          Code
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.links.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Links</h3>
              <div className="flex flex-wrap gap-4">
                {profile.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>This is a preview of your published profile.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

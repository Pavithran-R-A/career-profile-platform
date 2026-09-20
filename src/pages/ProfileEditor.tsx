import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { getSupabaseClient } from '../lib/supabase/client';
import type { ProfileWithRelations } from '../lib/profiles/repository';

type EditSection = 'basics' | 'experience' | 'education' | 'projects' | 'skills' | 'links';

export default function ProfileEditor() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<EditSection>('basics');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        setProfile(p);
        setLoading(false);
      });
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

  useEffect(() => {
    if (!loading && auth.status === 'authenticated' && !profile) {
      void navigate('/onboarding');
    }
  }, [loading, auth, profile, navigate]);

  if (auth.status === 'loading' || loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const handleBasicsUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const updates = {
      display_name: formData.get('displayName') as string,
      headline: formData.get('headline') as string,
      about: formData.get('about') as string,
      location: formData.get('location') as string,
    };

    try {
      await profileService.updateProfile(profile.id, updates);
      setProfile({ ...profile, ...updates });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleExperienceAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newExperience = {
      profile_id: profile.id,
      company: formData.get('company') as string,
      role: formData.get('role') as string,
      location: (formData.get('location') as string) || null,
      start_year: parseInt(formData.get('startYear') as string),
      start_month: formData.get('startMonth')
        ? parseInt(formData.get('startMonth') as string)
        : null,
      end_year: formData.get('endYear') ? parseInt(formData.get('endYear') as string) : null,
      end_month: formData.get('endMonth') ? parseInt(formData.get('endMonth') as string) : null,
      is_current: formData.get('isCurrent') === 'on',
      description: (formData.get('description') as string) || null,
      sort_order: profile.experiences.length,
    };

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profile_experiences')
        .insert(newExperience)
        .select()
        .single();

      if (error) throw error;

      setProfile({
        ...profile,
        experiences: [...profile.experiences, data],
      });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add experience');
    } finally {
      setSaving(false);
    }
  };

  const handleExperienceDelete = async (experienceId: string) => {
    if (!confirm('Are you sure you want to delete this experience?')) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('profile_experiences').delete().eq('id', experienceId);

      if (error) throw error;

      setProfile({
        ...profile,
        experiences: profile.experiences.filter((e) => e.id !== experienceId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete experience');
    } finally {
      setSaving(false);
    }
  };

  const handleEducationAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newEducation = {
      profile_id: profile.id,
      institution: formData.get('institution') as string,
      degree: (formData.get('degree') as string) || null,
      field_of_study: (formData.get('fieldOfStudy') as string) || null,
      start_year: formData.get('startYear') ? parseInt(formData.get('startYear') as string) : null,
      start_month: formData.get('startMonth')
        ? parseInt(formData.get('startMonth') as string)
        : null,
      end_year: formData.get('endYear') ? parseInt(formData.get('endYear') as string) : null,
      end_month: formData.get('endMonth') ? parseInt(formData.get('endMonth') as string) : null,
      description: (formData.get('description') as string) || null,
      sort_order: profile.education.length,
    };

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profile_education')
        .insert(newEducation as never)
        .select()
        .single();

      if (error) throw error;

      setProfile({
        ...profile,
        education: [...profile.education, data],
      });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add education');
    } finally {
      setSaving(false);
    }
  };

  const handleEducationDelete = async (educationId: string) => {
    if (!confirm('Are you sure you want to delete this education?')) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('profile_education').delete().eq('id', educationId);

      if (error) throw error;

      setProfile({
        ...profile,
        education: profile.education.filter((e) => e.id !== educationId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete education');
    } finally {
      setSaving(false);
    }
  };

  const handleProjectAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newProject = {
      profile_id: profile.id,
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      project_url: (formData.get('projectUrl') as string) || null,
      repository_url: (formData.get('repositoryUrl') as string) || null,
      sort_order: profile.projects.length,
    };

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profile_projects')
        .insert(newProject as never)
        .select()
        .single();

      if (error) throw error;

      setProfile({
        ...profile,
        projects: [...profile.projects, data],
      });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project');
    } finally {
      setSaving(false);
    }
  };

  const handleProjectDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('profile_projects').delete().eq('id', projectId);

      if (error) throw error;

      setProfile({
        ...profile,
        projects: profile.projects.filter((p) => p.id !== projectId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setSaving(false);
    }
  };

  const handleSkillAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newSkill = {
      profile_id: profile.id,
      name: formData.get('name') as string,
      category: (formData.get('category') as string) || null,
      sort_order: profile.skills.length,
    };

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profile_skills')
        .insert(newSkill as never)
        .select()
        .single();

      if (error) throw error;

      setProfile({
        ...profile,
        skills: [...profile.skills, data],
      });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add skill');
    } finally {
      setSaving(false);
    }
  };

  const handleSkillDelete = async (skillId: string) => {
    if (!confirm('Are you sure you want to delete this skill?')) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('profile_skills').delete().eq('id', skillId);

      if (error) throw error;

      setProfile({
        ...profile,
        skills: profile.skills.filter((s) => s.id !== skillId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete skill');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newLink = {
      profile_id: profile.id,
      label: formData.get('label') as string,
      url: formData.get('url') as string,
      sort_order: profile.links.length,
    };

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profile_links')
        .insert(newLink as never)
        .select()
        .single();

      if (error) throw error;

      setProfile({
        ...profile,
        links: [...profile.links, data],
      });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add link');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkDelete = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('profile_links').delete().eq('id', linkId);

      if (error) throw error;

      setProfile({
        ...profile,
        links: profile.links.filter((l) => l.id !== linkId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete link');
    } finally {
      setSaving(false);
    }
  };

  const sections: { id: EditSection; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'projects', label: 'Projects' },
    { id: 'skills', label: 'Skills' },
    { id: 'links', label: 'Links' },
  ];

  const handleBackToDashboard = () => {
    void navigate('/dashboard');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Edit profile</h1>
        <button onClick={handleBackToDashboard} className="text-gray-600 hover:text-gray-900">
          ← Back to dashboard
        </button>
      </div>

      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6"
          role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          Profile updated successfully
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <nav className="md:w-48 flex-shrink-0">
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-md ${
                    activeSection === section.id
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1">
          {activeSection === 'basics' && (
            <form onSubmit={(e) => void handleBasicsUpdate(e)} className="space-y-4">
              <h2 className="text-lg font-medium mb-4">Basic information</h2>
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  defaultValue={profile.display_name || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="headline" className="block text-sm font-medium mb-1">
                  Headline
                </label>
                <input
                  id="headline"
                  name="headline"
                  type="text"
                  defaultValue={profile.headline || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="about" className="block text-sm font-medium mb-1">
                  About
                </label>
                <textarea
                  id="about"
                  name="about"
                  defaultValue={profile.about || ''}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium mb-1">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  defaultValue={profile.location || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          )}

          {activeSection === 'experience' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Experience</h2>
              {profile.experiences.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {profile.experiences.map((exp) => (
                    <div key={exp.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{exp.role}</h3>
                          <p className="text-gray-600">{exp.company}</p>
                          <p className="text-sm text-gray-500">
                            {exp.start_year}
                            {exp.start_month ? `/${exp.start_month}` : ''} -{' '}
                            {exp.is_current
                              ? 'Present'
                              : exp.end_year
                                ? `${exp.end_year}${exp.end_month ? `/${exp.end_month}` : ''}`
                                : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            void handleExperienceDelete(exp.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm">
                          Delete
                        </button>
                      </div>
                      {exp.description && (
                        <p className="mt-2 text-sm text-gray-600">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-6">No experience added yet.</p>
              )}

              <form
                onSubmit={(e) => void handleExperienceAdd(e)}
                className="border border-gray-200 rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Add experience</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium mb-1">
                      Company
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium mb-1">
                      Role
                    </label>
                    <input
                      id="role"
                      name="role"
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium mb-1">
                    Location
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="startYear" className="block text-sm font-medium mb-1">
                      Start Year
                    </label>
                    <input
                      id="startYear"
                      name="startYear"
                      type="number"
                      min="1900"
                      max="2099"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="startMonth" className="block text-sm font-medium mb-1">
                      Month
                    </label>
                    <input
                      id="startMonth"
                      name="startMonth"
                      type="number"
                      min="1"
                      max="12"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="endYear" className="block text-sm font-medium mb-1">
                      End Year
                    </label>
                    <input
                      id="endYear"
                      name="endYear"
                      type="number"
                      min="1900"
                      max="2099"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="endMonth" className="block text-sm font-medium mb-1">
                      Month
                    </label>
                    <input
                      id="endMonth"
                      name="endMonth"
                      type="number"
                      min="1"
                      max="12"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    id="isCurrent"
                    name="isCurrent"
                    type="checkbox"
                    className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                  />
                  <label htmlFor="isCurrent" className="ml-2 text-sm text-gray-600">
                    Current position
                  </label>
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Adding...' : 'Add experience'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'education' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Education</h2>
              {profile.education.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {profile.education.map((edu) => (
                    <div key={edu.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{edu.institution}</h3>
                          {edu.degree && (
                            <p className="text-gray-600">
                              {edu.degree}
                              {edu.field_of_study ? ` in ${edu.field_of_study}` : ''}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">
                            {edu.start_year
                              ? `${edu.start_year}${edu.start_month ? `/${edu.start_month}` : ''}`
                              : ''}{' '}
                            -{' '}
                            {edu.end_year
                              ? `${edu.end_year}${edu.end_month ? `/${edu.end_month}` : ''}`
                              : 'Present'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            void handleEducationDelete(edu.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm">
                          Delete
                        </button>
                      </div>
                      {edu.description && (
                        <p className="mt-2 text-sm text-gray-600">{edu.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-6">No education added yet.</p>
              )}

              <form
                onSubmit={(e) => void handleEducationAdd(e)}
                className="border border-gray-200 rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Add education</h3>
                <div>
                  <label htmlFor="institution" className="block text-sm font-medium mb-1">
                    Institution
                  </label>
                  <input
                    id="institution"
                    name="institution"
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="degree" className="block text-sm font-medium mb-1">
                      Degree
                    </label>
                    <input
                      id="degree"
                      name="degree"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="fieldOfStudy" className="block text-sm font-medium mb-1">
                      Field of Study
                    </label>
                    <input
                      id="fieldOfStudy"
                      name="fieldOfStudy"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="startYear" className="block text-sm font-medium mb-1">
                      Start Year
                    </label>
                    <input
                      id="startYear"
                      name="startYear"
                      type="number"
                      min="1900"
                      max="2099"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="startMonth" className="block text-sm font-medium mb-1">
                      Month
                    </label>
                    <input
                      id="startMonth"
                      name="startMonth"
                      type="number"
                      min="1"
                      max="12"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="endYear" className="block text-sm font-medium mb-1">
                      End Year
                    </label>
                    <input
                      id="endYear"
                      name="endYear"
                      type="number"
                      min="1900"
                      max="2099"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="endMonth" className="block text-sm font-medium mb-1">
                      Month
                    </label>
                    <input
                      id="endMonth"
                      name="endMonth"
                      type="number"
                      min="1"
                      max="12"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Adding...' : 'Add education'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'projects' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Projects</h2>
              {profile.projects.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {profile.projects.map((project) => (
                    <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{project.name}</h3>
                          {project.description && (
                            <p className="text-gray-600 text-sm mt-1">{project.description}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            {project.project_url && (
                              <a
                                href={project.project_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-gray-900">
                                Project URL
                              </a>
                            )}
                            {project.repository_url && (
                              <a
                                href={project.repository_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-gray-900">
                                Repository
                              </a>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            void handleProjectDelete(project.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-6">No projects added yet.</p>
              )}

              <form
                onSubmit={(e) => void handleProjectAdd(e)}
                className="border border-gray-200 rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Add project</h3>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="projectUrl" className="block text-sm font-medium mb-1">
                      Project URL
                    </label>
                    <input
                      id="projectUrl"
                      name="projectUrl"
                      type="url"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="repositoryUrl" className="block text-sm font-medium mb-1">
                      Repository URL
                    </label>
                    <input
                      id="repositoryUrl"
                      name="repositoryUrl"
                      type="url"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Adding...' : 'Add project'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'skills' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Skills</h2>
              {profile.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-6">
                  {profile.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                      <span>{skill.name}</span>
                      <button
                        onClick={() => {
                          void handleSkillDelete(skill.id);
                        }}
                        className="text-gray-500 hover:text-red-600">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-6">No skills added yet.</p>
              )}

              <form
                onSubmit={(e) => void handleSkillAdd(e)}
                className="border border-gray-200 rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Add skill</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-1">
                      Skill Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium mb-1">
                      Category
                    </label>
                    <input
                      id="category"
                      name="category"
                      type="text"
                      placeholder="e.g., Programming, Design"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Adding...' : 'Add skill'}
                </button>
              </form>
            </div>
          )}

          {activeSection === 'links' && (
            <div>
              <h2 className="text-lg font-medium mb-4">Links</h2>
              {profile.links.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {profile.links.map((link) => (
                    <div key={link.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">{link.label}</h3>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-600 hover:text-gray-900">
                            {link.url}
                          </a>
                        </div>
                        <button
                          onClick={() => {
                            void handleLinkDelete(link.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-6">No links added yet.</p>
              )}

              <form
                onSubmit={(e) => void handleLinkAdd(e)}
                className="border border-gray-200 rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Add link</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="label" className="block text-sm font-medium mb-1">
                      Label
                    </label>
                    <input
                      id="label"
                      name="label"
                      type="text"
                      required
                      placeholder="e.g., LinkedIn, GitHub"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="url" className="block text-sm font-medium mb-1">
                      URL
                    </label>
                    <input
                      id="url"
                      name="url"
                      type="url"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Adding...' : 'Add link'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

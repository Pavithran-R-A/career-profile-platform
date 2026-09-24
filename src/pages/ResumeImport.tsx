import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ResumeService } from '../lib/resume/service';
import { ProfileService } from '../lib/profiles/service';
import { toCustomerMessage } from '../lib/resume/errors';
import type { ResumeExtraction } from '../lib/ai/provider';

type ResumeState =
  | 'empty'
  | 'uploading'
  | 'extracting'
  | 'structuring'
  | 'review'
  | 'applying'
  | 'complete'
  | 'error';

export default function ResumeImport() {
  const auth = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ResumeState>('empty');
  const [error, setError] = useState<string | null>(null);
  const [extractionBlocked, setExtractionBlocked] = useState(false);
  const [draft, setDraft] = useState<ResumeExtraction | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [resumeService, setResumeService] = useState<ResumeService | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState('uploading');
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const supabase = (await import('../lib/supabase/client')).getSupabaseClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      // Share the authenticated client so storage/RLS calls carry the session.
      const service = new ResumeService(supabaseUrl, publishableKey, supabase);
      setResumeService(service);

      // Resolve the authenticated user's canonical owned profile first.
      // Never pass a pseudo-ID into the uuid column.
      const profileService = new ProfileService();
      const profile = await profileService.getProfile(session.user.id);
      if (!profile) {
        void navigate('/onboarding');
        return;
      }

      const resume = await service.uploadResume(session.user.id, profile.id, file);
      setState('extracting');

      const extractionResult = await extractAndStructure(resume.id);

      setDraft(extractionResult);
      setState('review');
    } catch (err) {
      // The upload itself succeeded here; only automatic extraction is
      // unavailable. Say so plainly instead of a generic failure.
      if (err instanceof Error && err.message === 'AI extraction is not configured') {
        setExtractionBlocked(true);
        setState('empty');
        return;
      }
      setError(toCustomerMessage(err, 'save'));
      setState('error');
    }
  };

  const extractAndStructure = async (resumeSourceId: string): Promise<ResumeExtraction> => {
    setState('structuring');

    const supabase = (await import('../lib/supabase/client')).getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch('/api/resume/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ resumeSourceId }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: string };
      throw new Error(errorData.error || 'Extraction failed');
    }

    return response.json();
  };

  const handleApply = async () => {
    if (!draft || !resumeService) return;

    setState('applying');

    try {
      const supabase = (await import('../lib/supabase/client')).getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile) {
        throw new Error('Profile not found');
      }

      if (selectedSections.has('experience') && draft.experience.length > 0) {
        const experiences = draft.experience.map((exp, index) => ({
          profile_id: profile.id,
          company: exp.company,
          role: exp.role,
          location: exp.location || null,
          start_year: parseInt(exp.startDate?.split('-')[0] || '2020'),
          start_month: exp.startDate ? parseInt(exp.startDate.split('-')[1] || '1') : null,
          end_year: exp.endDate ? parseInt(exp.endDate.split('-')[0]) : null,
          end_month: exp.endDate ? parseInt(exp.endDate.split('-')[1] || '1') : null,
          is_current: exp.isCurrent || false,
          description: exp.description || null,
          sort_order: index,
        }));

        const { error } = await supabase.from('profile_experiences').insert(experiences);
        if (error) throw error;
      }

      setState('complete');
      setTimeout(() => {
        void navigate('/dashboard/profile');
      }, 2000);
    } catch (err) {
      setError(toCustomerMessage(err, 'save'));
      setState('error');
    }
  };

  const toggleSection = (section: string) => {
    const newSelected = new Set(selectedSections);
    if (newSelected.has(section)) {
      newSelected.delete(section);
    } else {
      newSelected.add(section);
    }
    setSelectedSections(newSelected);
  };

  if (auth.status !== 'authenticated') {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Import Resume</h1>
        <button
          onClick={() => void navigate('/dashboard')}
          className="text-gray-600 hover:text-gray-900">
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

      {extractionBlocked && state === 'empty' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Resume saved.</p>
          <p className="text-sm mt-1">
            Automatic extraction isn&apos;t available on this environment, so nothing was filled in
            for you. You can add the details manually in the profile editor.
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            <button
              onClick={() => void navigate('/dashboard/profile')}
              className="bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 text-sm">
              Go to profile editor
            </button>
            <button
              onClick={() => setExtractionBlocked(false)}
              className="border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 text-sm">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {state === 'empty' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">
            Upload your PDF resume to extract profile information
          </p>
          <p className="text-sm text-gray-500 mb-4">PDF files up to 6 MiB, maximum 20 pages</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => void handleFileSelect(e)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-900 text-white py-2 px-6 rounded-md hover:bg-gray-800">
            Select PDF
          </button>
        </div>
      )}

      {state === 'uploading' && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Uploading resume...</p>
        </div>
      )}

      {state === 'extracting' && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Reading resume...</p>
        </div>
      )}

      {state === 'structuring' && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Structuring profile...</p>
        </div>
      )}

      {state === 'review' && draft && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
            Review the extracted information below. Select which sections to add to your profile.
          </div>

          <div className="space-y-4">
            {draft.identity.displayName && (
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSections.has('identity')}
                    onChange={() => toggleSection('identity')}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-medium">Basic Information</h3>
                    <p className="text-sm text-gray-600">Name: {draft.identity.displayName}</p>
                    {draft.identity.headline && (
                      <p className="text-sm text-gray-600">Headline: {draft.identity.headline}</p>
                    )}
                    {draft.identity.location && (
                      <p className="text-sm text-gray-600">Location: {draft.identity.location}</p>
                    )}
                  </div>
                </label>
              </div>
            )}

            {draft.experience.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSections.has('experience')}
                    onChange={() => toggleSection('experience')}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-medium">Experience ({draft.experience.length} items)</h3>
                    {draft.experience.slice(0, 3).map((exp, i) => (
                      <p key={i} className="text-sm text-gray-600">
                        {exp.role} at {exp.company}
                      </p>
                    ))}
                  </div>
                </label>
              </div>
            )}

            {draft.education.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSections.has('education')}
                    onChange={() => toggleSection('education')}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-medium">Education ({draft.education.length} items)</h3>
                    {draft.education.slice(0, 3).map((edu, i) => (
                      <p key={i} className="text-sm text-gray-600">
                        {edu.degree || 'Degree'} at {edu.institution}
                      </p>
                    ))}
                  </div>
                </label>
              </div>
            )}

            {draft.skills.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSections.has('skills')}
                    onChange={() => toggleSection('skills')}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-medium">Skills ({draft.skills.length} items)</h3>
                    <p className="text-sm text-gray-600">
                      {draft.skills
                        .slice(0, 5)
                        .map((s) => s.name)
                        .join(', ')}
                    </p>
                  </div>
                </label>
              </div>
            )}

            {draft.projects.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSections.has('projects')}
                    onChange={() => toggleSection('projects')}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-medium">Projects ({draft.projects.length} items)</h3>
                    {draft.projects.slice(0, 3).map((proj, i) => (
                      <p key={i} className="text-sm text-gray-600">
                        {proj.name}
                      </p>
                    ))}
                  </div>
                </label>
              </div>
            )}

            {draft.links.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSections.has('links')}
                    onChange={() => toggleSection('links')}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-medium">Links ({draft.links.length} items)</h3>
                    {draft.links.slice(0, 3).map((link, i) => (
                      <p key={i} className="text-sm text-gray-600">
                        {link.label}: {link.url}
                      </p>
                    ))}
                  </div>
                </label>
              </div>
            )}

            {draft.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2">Warnings</h3>
                {draft.warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-yellow-700">
                    {warning}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => void handleApply()}
              disabled={selectedSections.size === 0}
              className="bg-gray-900 text-white py-2 px-6 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
              Apply to Profile
            </button>
            <button
              onClick={() => {
                setState('empty');
                setDraft(null);
                setError(null);
              }}
              className="border border-gray-300 text-gray-700 py-2 px-6 rounded-md hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === 'applying' && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Applying changes...</p>
        </div>
      )}

      {state === 'complete' && (
        <div className="text-center py-12">
          <div className="text-green-500 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">Resume imported successfully!</p>
          <p className="text-sm text-gray-500">Redirecting to profile editor...</p>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={() => {
              setState('empty');
              setDraft(null);
              setError(null);
            }}
            className="bg-gray-900 text-white py-2 px-6 rounded-md hover:bg-gray-800">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

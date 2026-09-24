import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { getPreferences, type ProfilePreferences } from '../lib/profiles/preferences';
import { getTemplate } from '../lib/templates/types';
import { getTemplateComponent } from '../lib/templates/registry';
import type { ProfileWithRelations } from '../lib/profiles/repository';
import AppearanceControls from '../components/AppearanceControls';

const DEFAULT_PREFERENCES: ProfilePreferences = {
  id: '',
  profile_id: '',
  template_key: 'minimal',
  accent_key: 'blue',
  section_order: ['basics', 'education', 'experience', 'skills', 'projects'],
  hidden_sections: [],
};

export default function AppearanceEditor() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status !== 'authenticated') return;

    void (async () => {
      try {
        const loaded = await profileService.getProfile(auth.user.id);
        if (!loaded) {
          void navigate('/onboarding');
          return;
        }
        setProfile(loaded);
        const prefs = await getPreferences(loaded.id);
        if (prefs) {
          setPreferences(prefs);
        } else {
          setPreferences({ ...DEFAULT_PREFERENCES, profile_id: loaded.id });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [auth, navigate, profileService]);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

  if (auth.status === 'loading' || loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const template = getTemplate(preferences.template_key);
  const PreviewComponent = getTemplateComponent(preferences.template_key);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Appearance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Customize how your published profile looks to visitors.
          </p>
        </div>
        <button
          onClick={() => void navigate('/dashboard')}
          className="text-gray-600 hover:text-gray-900">
          &larr; Back to dashboard
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <AppearanceControls
          profileId={profile.id}
          preferences={preferences}
          onChange={setPreferences}
        />
      </div>

      <section aria-label="Template preview" className="mt-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-medium">Live preview</h2>
          <p className="text-xs text-gray-500">
            Showing the {template?.metadata.name ?? 'Minimal'} template. Saving a change above
            updates this preview.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <PreviewComponent
            profile={profile}
            config={template?.config ?? getTemplate('minimal')!.config}
            preferences={{
              accentKey: preferences.accent_key,
              sectionOrder: preferences.section_order,
              hiddenSections: preferences.hidden_sections,
            }}
          />
        </div>
      </section>
    </div>
  );
}

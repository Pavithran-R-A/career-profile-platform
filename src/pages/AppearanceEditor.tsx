import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { getPreferences, type ProfilePreferences } from '../lib/profiles/preferences';
import AppearanceControls from '../components/AppearanceControls';

const DEFAULT_PREFERENCES: ProfilePreferences = {
  id: '',
  profile_id: '',
  template_key: 'classic',
  accent_key: 'blue',
  section_order: ['basics', 'education', 'experience', 'skills', 'projects'],
  hidden_sections: [],
};

export default function AppearanceEditor() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status !== 'authenticated') return;

    void (async () => {
      try {
        const profile = await profileService.getProfile(auth.user.id);
        if (!profile) {
          void navigate('/onboarding');
          return;
        }
        setProfileId(profile.id);
        const prefs = await getPreferences(profile.id);
        if (prefs) {
          setPreferences(prefs);
        } else {
          setPreferences({ ...DEFAULT_PREFERENCES, profile_id: profile.id });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [auth, navigate, profileService]);

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

  if (auth.status === 'unauthenticated' || !profileId) {
    return null;
  }

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
          profileId={profileId}
          preferences={preferences}
          onChange={setPreferences}
        />
      </div>
    </div>
  );
}

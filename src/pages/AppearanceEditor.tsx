import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { getPreferences, type ProfilePreferences } from '../lib/profiles/preferences';
import { getTemplate } from '../lib/templates/types';
import { TemplateCanvas } from '../components/portfolio/TemplateCanvas';
import type { ProfileWithRelations } from '../lib/profiles/repository';
import AppearanceControls from '../components/AppearanceControls';
import { useNoindexMeta } from '../lib/seo/usePageMeta';

const DEFAULT_PREFERENCES: ProfilePreferences = {
  id: '',
  profile_id: '',
  template_key: 'minimal',
  accent_key: 'blue',
  section_order: ['basics', 'education', 'experience', 'skills', 'projects'],
  hidden_sections: [],
};

export default function AppearanceEditor() {
  useNoindexMeta('Appearance — Career Profile');
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

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Appearance</h1>
          <p className="page-subtitle">
            A small design studio for your portfolio — changes preview instantly.
          </p>
        </div>
        <button onClick={() => void navigate('/dashboard')} className="link-quiet text-sm">
          &larr; Back to dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)] gap-6 items-start">
        {/* Controls */}
        <div className="card card-pad">
          <AppearanceControls
            profileId={profile.id}
            preferences={preferences}
            onChange={setPreferences}
          />
        </div>

        {/* Large live preview */}
        <section aria-label="Template preview" className="xl:sticky xl:top-24">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="section-title">Live preview</h2>
            <p className="text-xs text-[var(--faint-foreground)]">
              Showing the {template?.metadata.name ?? 'Minimal'} template — saving a change above
              updates this preview.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-[var(--border)] bg-[var(--surface-warm)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
              <span className="ml-2 text-[11px] text-[var(--faint-foreground)] truncate">
                /u/{profile.username}
              </span>
            </div>
            <TemplateCanvas
              key={preferences.template_key}
              templateKey={preferences.template_key}
              profile={profile}
              preferences={{
                accentKey: preferences.accent_key,
                sectionOrder: preferences.section_order,
                hiddenSections: preferences.hidden_sections,
              }}
              scale={0.78}
              height={640}
              label={`Live ${template?.metadata.name ?? 'Minimal'} template preview`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

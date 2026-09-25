import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { getPreferences, type ProfilePreferences } from '../lib/profiles/preferences';
import { getTemplate } from '../lib/templates/types';
import { getTemplateComponent } from '../lib/templates/registry';
import type { ProfileWithRelations } from '../lib/profiles/repository';

export default function DashboardPreview() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    void (async () => {
      try {
        const p = await profileService.getProfile(auth.user.id);
        if (p) {
          const prefs = await getPreferences(p.id);
          setPreferences(prefs);
          setProfile(p);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [auth]);

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
      <div className="page-shell" role="status" aria-label="Loading preview">
        <div className="space-y-4">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-96 w-full" />
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated') return null;

  if (!profile) {
    void navigate('/onboarding');
    return null;
  }

  const templateKey = preferences?.template_key || 'minimal';
  const template = getTemplate(templateKey) ?? getTemplate('minimal')!;
  const TemplateComponent = getTemplateComponent(templateKey);
  const isPublished = profile.visibility === 'published';

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Preview toolbar — owner context, distinct from the public page */}
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="status-chip !text-[11px]">Preview</span>
            <span className="text-xs text-[var(--faint-foreground)] truncate">
              {template.metadata.name} template · as visitors see it
            </span>
            <span className={`status-chip !text-[11px] ${isPublished ? 'status-chip-live' : ''}`}>
              {isPublished ? 'Published' : 'Draft'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void navigate('/dashboard/profile')}
              className="h-9 px-3 rounded-lg text-xs font-semibold border border-[var(--border-strong)] hover:bg-[var(--surface-muted)]">
              Edit profile
            </button>
            <button
              onClick={() => void navigate('/dashboard/appearance')}
              className="h-9 px-3 rounded-lg text-xs font-semibold border border-[var(--border-strong)] hover:bg-[var(--surface-muted)]">
              Appearance
            </button>
            <button
              onClick={() => void navigate('/dashboard')}
              className="h-9 px-3 rounded-lg text-xs font-semibold bg-[var(--ink)] text-white hover:bg-[#1d2939]">
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Fidelity frame — the actual template, not a generic card */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="rounded-xl overflow-hidden border border-[var(--border)] shadow-[var(--shadow-pop)]">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[#f2f3f5]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
            <span className="ml-3 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-0.5 truncate">
              /u/{profile.username}
            </span>
            {!isPublished && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                Preview of draft
              </span>
            )}
          </div>
          <div className="bg-white">
            <TemplateComponent
              profile={profile}
              config={template.config}
              preferences={
                preferences
                  ? {
                      accentKey: preferences.accent_key,
                      sectionOrder: preferences.section_order,
                      hiddenSections: preferences.hidden_sections,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useBlocker } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { getPreferences, type ProfilePreferences } from '../lib/profiles/preferences';
import {
  initialAppearanceState,
  setTemplate,
  setAccent,
  moveSection,
  setSectionHidden,
  resetToSaved,
  saveAppearance,
  type AppearanceState,
} from '../lib/profiles/appearance-draft';
import { getTemplate } from '../lib/templates/types';
import { TemplateCanvas } from '../components/portfolio/TemplateCanvas';
import type { ProfileWithRelations } from '../lib/profiles/repository';
import AppearanceControls from '../components/AppearanceControls';
import { useNoindexMeta } from '../lib/seo/usePageMeta';

export default function AppearanceEditor() {
  useNoindexMeta('Appearance — CareerProfile Go');
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [appearance, setAppearance] = useState<AppearanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<number | null>(null);

  // Module-singleton ProfileService would remount loops; construct once.
  const profileServiceRef = useRef<ProfileService | null>(null);
  if (!profileServiceRef.current) profileServiceRef.current = new ProfileService();

  useEffect(() => {
    if (auth.status !== 'authenticated') return;

    void (async () => {
      try {
        const loaded = await profileServiceRef.current!.getProfile(auth.user.id);
        if (!loaded) {
          void navigate('/onboarding');
          return;
        }
        setProfile(loaded);
        const prefs = await getPreferences(loaded.id);
        setAppearance(initialAppearanceState(prefs));
      } finally {
        setLoading(false);
      }
    })();
  }, [auth, navigate]);

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

  // Debounced autosave: every draft change persists shortly after; the
  // preview updates instantly from draft state, never waiting for the wire.
  const queueSave = useCallback((state: AppearanceState) => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveAppearance(state).then(setAppearance);
    }, 600);
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    []
  );

  // Warn before leaving with unsaved changes (autosave makes this rare —
  // it fires only when persistence failed and the user navigates anyway).
  // useBlocker needs a data router; the App uses BrowserRouter (data mode),
  // but guard anyway so embedders/tests without a data router don't crash.
  let blocker: ReturnType<typeof useBlocker> | { state: 'idle' } = { state: 'idle' };
  try {
    blocker = useBlocker(
      ({ currentLocation, nextLocation }) =>
        Boolean(appearance?.dirty) && currentLocation.pathname !== nextLocation.pathname
    );
  } catch {
    // No data router context: skip in-app nav blocking.
  }

  const update = useCallback(
    (next: AppearanceState) => {
      setAppearance(next);
      queueSave(next);
    },
    [queueSave]
  );

  if (auth.status === 'loading' || loading || !appearance) {
    return (
      <div className="page-shell" role="status" aria-label="Loading appearance">
        <div className="space-y-4">
          <div className="skeleton h-9 w-56" />
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)] gap-6">
            <div className="skeleton h-[560px] rounded-xl" />
            <div className="skeleton h-[560px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const preferences: ProfilePreferences = appearance.current;
  const template = getTemplate(preferences.template_key);
  const templateName = template?.metadata.name ?? 'Minimal';

  const statusChip =
    appearance.status === 'error'
      ? { label: "Couldn't save — retry", cls: 'status-chip-danger', action: 'retry' as const }
      : appearance.status === 'saving'
        ? { label: 'Saving…', cls: 'status-chip', action: null }
        : appearance.dirty
          ? { label: 'Unsaved', cls: 'status-chip', action: null }
          : { label: 'Saved', cls: 'status-chip-live', action: null };

  const onRetry = () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void saveAppearance(appearance).then(setAppearance);
  };

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-8">
      {blocker.state === 'blocked' && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="appearance-blocker-title">
          <div className="card card-pad max-w-md w-full">
            <h2 id="appearance-blocker-title" className="section-title">
              Unsaved appearance changes
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              Your latest change could not be saved yet. Leave anyway, or stay and try again?
            </p>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => void blocker.proceed()}
                className="btn btn-primary flex-1">
                Leave anyway
              </button>
              <button
                type="button"
                onClick={() => void blocker.reset()}
                className="btn btn-secondary flex-1">
                Stay and retry
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Appearance</h1>
          <p className="page-subtitle">
            A small design studio for your portfolio — changes preview instantly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`status-chip !text-[11px] ${statusChip.cls}`}
            role="status"
            aria-live="polite">
            {statusChip.label}
          </span>
          {statusChip.action === 'retry' && (
            <button
              type="button"
              onClick={onRetry}
              className="text-sm font-semibold"
              style={{ color: 'var(--accent-text)' }}>
              Retry
            </button>
          )}
          {appearance.dirty && (
            <button
              type="button"
              onClick={() => {
                if (saveTimer.current !== null) {
                  window.clearTimeout(saveTimer.current);
                  saveTimer.current = null;
                }
                setAppearance(resetToSaved(appearance));
              }}
              className="link-quiet text-sm">
              Reset to saved
            </button>
          )}
          <button onClick={() => void navigate('/dashboard')} className="link-quiet text-sm">
            &larr; Back to dashboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)] gap-6 items-start">
        {/* Controls — mutate the same draft the preview renders */}
        <div className="card card-pad">
          <AppearanceControls
            draft={appearance.current}
            onTemplate={(key) => update(setTemplate(appearance, key))}
            onAccent={(key) => update(setAccent(appearance, key))}
            onMoveSection={(index, dir) => update(moveSection(appearance, index, dir))}
            onSectionHidden={(section, hidden) =>
              update(setSectionHidden(appearance, section, hidden))
            }
          />
        </div>

        {/* Large live preview — renders from draft state, no refetch */}
        <section aria-label="Template preview" className="xl:sticky xl:top-24">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="section-title">Live preview</h2>
            <p className="text-xs text-[var(--faint-foreground)]">
              {templateName} template · updates as you change controls
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
              label={`Live ${templateName} template preview`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

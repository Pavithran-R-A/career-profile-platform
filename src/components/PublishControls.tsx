import { useState } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';

interface PublishControlsProps {
  profileId: string;
  isPublished: boolean;
  onPublishChange: (published: boolean) => void;
  variant?: 'light' | 'dark';
}

/**
 * The single publish/unpublish surface for a portfolio. The Dashboard renders
 * it exactly once; no other component may offer publish actions.
 */
export default function PublishControls({
  profileId,
  isPublished,
  onPublishChange,
  variant = 'light',
}: PublishControlsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = variant === 'dark';

  const handleToggle = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const newVisibility = isPublished ? 'draft' : 'published';
      const publishedAt = isPublished ? null : new Date().toISOString();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          visibility: newVisibility,
          published_at: publishedAt,
        })
        .eq('id', profileId);

      if (updateError) throw updateError;

      onPublishChange(!isPublished);
    } catch {
      setError("We couldn't update publishing. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isDark ? '' : 'rounded-xl border border-[var(--border)] p-4'}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[var(--ink)]'}`}>
            {isPublished ? 'Your portfolio is public' : 'Ready to share?'}
          </p>
          <p
            className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-[var(--faint-foreground)]'}`}>
            {isPublished
              ? 'Anyone with your link can view it. Unpublish to make it private again.'
              : 'Publishing makes your link viewable by anyone. You can unpublish anytime.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={loading}
          className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isPublished
              ? isDark
                ? 'bg-white/10 border border-white/25 text-white hover:bg-white/15'
                : 'bg-white border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]'
              : isDark
                ? 'bg-emerald-400 text-[#0b1220] hover:bg-emerald-300 font-semibold'
                : 'bg-[var(--ink)] text-white hover:bg-[#1d2939]'
          }`}>
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
              {isPublished ? 'Unpublishing…' : 'Publishing…'}
            </span>
          ) : isPublished ? (
            'Unpublish'
          ) : (
            'Publish portfolio'
          )}
        </button>
      </div>

      <p
        className={`text-xs mt-3 ${isDark ? 'text-white/70' : 'text-[var(--danger)]'}`}
        role="alert"
        aria-live="polite">
        {error}
      </p>
    </div>
  );
}

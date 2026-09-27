import { useState } from 'react';

/**
 * Share affordance for public profiles: copy link, open profile, and the
 * native Web Share API where it exists (falls back to copy everywhere).
 */
export default function ShareControls({
  url,
  title,
  dark = false,
}: {
  url: string;
  title: string;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — still honest.
      setCopied(false);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // User dismissed the share sheet; nothing to do.
    }
  };

  const base = dark
    ? 'text-white/80 border-white/25 hover:bg-white/10'
    : 'text-[var(--muted-foreground)] border-[var(--border-strong)] hover:bg-[var(--surface-muted)]';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copyLink()}
        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${base}`}>
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={() => void nativeShare()}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${base}`}>
          Share
        </button>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${base}`}>
        Open profile
      </a>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Profile link copied to clipboard' : ''}
      </span>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { getSupabaseClient } from '../lib/supabase/client';
import { useNoindexMeta } from '../lib/seo/usePageMeta';

type Phase = 'confirm' | 'reauth' | 'deleting' | 'done';

/**
 * Permanent account deletion.
 *
 * Flow: plain-language warning → mandatory fresh sign-in (verified JWT
 * claims; the server rejects tokens older than 10 minutes) → POST
 * /api/account/delete with the fresh token → sign out locally → land on the
 * home page. Deletion is permanent and spans multiple services; a failed
 * attempt may have partially completed, and retrying safely continues from
 * where the previous attempt stopped.
 */
export default function AccountDelete() {
  useNoindexMeta('Delete account — CVentory');
  const auth = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('confirm');
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status === 'loading') {
    return (
      <div className="page-shell">
        <div className="skeleton h-9 w-64" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (auth.status === 'unauthenticated') {
    return (
      <div className="page-shell">
        <div className="card card-pad max-w-md mx-auto text-center">
          <h1 className="page-title">Delete account</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Sign in to manage your account.
          </p>
          <Link to="/login" className="btn btn-primary mt-5 !min-h-[44px]">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const startReauth = () => {
    setError(null);
    setPhase('reauth');
  };

  const handleReauth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError('That sign-in did not match. Try again to continue.');
        return;
      }
      // Fresh session in hand — run the deletion with the new token.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError('Could not refresh your session. Please try again.');
        return;
      }

      setPhase('deleting');
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error === 'Please sign in again before deleting your account.'
            ? 'Please confirm your password again to continue.'
            : body.error || 'Deletion failed. Please try again.'
        );
        setPhase('reauth');
        return;
      }

      // Success: drop the local session and land somewhere neutral.
      await supabase.auth.signOut();
      setPhase('done');
      setTimeout(() => {
        void navigate('/', { replace: true });
      }, 2500);
    } catch {
      setError('Something went wrong. You are still signed in — please try again.');
      setPhase('reauth');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'done') {
    return (
      <div className="page-shell">
        <div className="card card-pad max-w-md mx-auto text-center" role="status">
          <h1 className="page-title">Account deleted</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Everything on your account has been removed. Redirecting you home…
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'deleting') {
    return (
      <div className="page-shell">
        <div
          className="card card-pad max-w-md mx-auto text-center"
          role="status"
          aria-live="polite">
          <div
            className="spinner w-8 h-8 mx-auto mb-4"
            style={{ borderBottomColor: 'var(--accent)' }}
          />
          <p className="text-sm font-medium text-[var(--ink)]">Deleting your account…</p>
          <p className="text-xs text-[var(--faint-foreground)] mt-1">
            This is permanent. Do not close this page.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'reauth') {
    return (
      <div className="page-shell">
        <div className="card card-pad max-w-md mx-auto">
          <h1 className="page-title">Confirm it&apos;s you</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2 mb-5">
            Signing in again proves this request is really you. Deletion starts right after.
          </p>

          {error && (
            <div className="alert alert-error mb-4" role="alert">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleReauth(e);
            }}
            className="space-y-4">
            <div>
              <label htmlFor="delete-email" className="field-label">
                Email
              </label>
              <input
                id="delete-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="delete-password" className="field-label">
                Password
              </label>
              <input
                id="delete-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn btn-danger btn-block !min-h-[44px]">
              {busy ? 'Checking…' : 'Sign in and delete my account'}
            </button>
            <button
              type="button"
              onClick={() => setPhase('confirm')}
              disabled={busy}
              className="btn btn-secondary btn-block !min-h-[44px]">
              Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Phase: confirm
  const emailForCopy = auth.status === 'authenticated' ? auth.user.email : null;

  return (
    <div className="page-shell">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Delete account</h1>
            <p className="page-subtitle">This is permanent and cannot be undone.</p>
          </div>
          <Link to="/dashboard" className="link-quiet text-sm">
            ← Back to dashboard
          </Link>
        </div>

        <div className="card card-pad border-[var(--danger-border)] bg-[var(--danger-surface)]">
          <h2 className="section-title">What gets deleted</h2>
          <ul className="text-sm text-[var(--muted-foreground)] mt-3 space-y-1.5 list-disc pl-5">
            <li>Your profile, portfolio, and public page</li>
            <li>Uploaded resumes and extracted data</li>
            <li>ATS resumes, tailored versions, and preferences</li>
            <li>Your sign-in account — you cannot log in again</li>
          </ul>
          <p className="text-sm text-[var(--ink)] mt-4 font-medium">
            There is no recovery. Consider unpublishing your portfolio instead if you only want it
            offline.
          </p>
        </div>

        {error && (
          <div className="alert alert-error mt-4" role="alert">
            {error}
          </div>
        )}

        <div className="card card-pad mt-4">
          <label htmlFor="confirm-delete" className="field-label">
            Type <span className="font-mono font-semibold">DELETE</span> to continue
          </label>
          <input
            id="confirm-delete"
            value={typedConfirmation}
            onChange={(e) => setTypedConfirmation(e.target.value)}
            autoComplete="off"
            className="field-input mt-2"
            placeholder="DELETE"
          />
          {emailForCopy && (
            <p className="text-xs text-[var(--faint-foreground)] mt-2">
              Signed in as {emailForCopy}
            </p>
          )}
          <button
            type="button"
            disabled={typedConfirmation !== 'DELETE'}
            onClick={startReauth}
            className="btn btn-danger btn-block mt-4 !min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed">
            Continue to confirmation
          </button>
          <Link to="/dashboard" className="btn btn-secondary btn-block mt-2 !min-h-[44px]">
            Keep my account
          </Link>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { getSupabaseClient } from '../lib/supabase/client';
import { useNoindexMeta } from '../lib/seo/usePageMeta';

interface EligibleInstallation {
  installationId: number;
  accountLogin: string;
  accountType: string;
  selectionToken: string;
}

type CallbackOutcome =
  | { state: 'processing' }
  | { state: 'select'; installations: EligibleInstallation[] }
  | { state: 'success' }
  | { state: 'error'; message: string };

/**
 * GitHub App install callback (browser side) — FLOW A: OAuth during install.
 *
 * GitHub redirects here with ?code&state (or error/error_description when
 * denied). There is NO installation_id parameter in this flow: the Setup URL
 * is unavailable when "Request user authorization (OAuth) during
 * installation" is enabled, so installations are resolved server-side from
 * GET /user/installations. This page:
 *   1. validates the query parameters (missing code/state and GitHub denial
 *      params are handled with truthful messages);
 *   2. requires a logged-in Supabase session;
 *   3. POSTs code + state to /api/github/callback — the server verifies the
 *      signed state, exchanges the code, and lists THIS app's installations
 *      accessible to that GitHub user;
 *   4. connects automatically when exactly one installation is eligible;
 *   5. asks the user to choose when several are eligible (each option carries
 *      a server-signed selection token — ids alone are not authority), then
 *      POSTs the choice to /api/github/connect/choose;
 *   6. redirects to /dashboard/github with a success/failure flag.
 */
export default function GitHubCallback() {
  useNoindexMeta('GitHub connection — CareerProfile Go');
  const auth = useAuth();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<CallbackOutcome>({ state: 'processing' });
  const startedRef = useRef(false);
  const connectingRef = useRef(false);

  const finishError = (message: string) => {
    setOutcome({ state: 'error', message });
    setTimeout(() => {
      void navigate('/dashboard/github?connect=failed');
    }, 2500);
  };

  const connectWithToken = async (selectionToken: string): Promise<boolean> => {
    const session = (await getSupabaseClient().auth.getSession()).data.session;
    if (!session?.access_token) {
      finishError('Please sign in first, then reconnect GitHub.');
      return false;
    }
    const res = await fetch('/api/github/connect/choose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ selectionToken }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      finishError(body.error || 'GitHub connection failed. Please retry from the dashboard.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (auth.status === 'loading') return;

    const params = new URLSearchParams(window.location.search);

    // GitHub denial / provider error params (user cancelled the install or
    // the authorization).
    const providerError = params.get('error');
    const errorDescription = params.get('error_description');
    const code = params.get('code');
    const state = params.get('state');

    if (auth.status === 'unauthenticated') {
      finishError('Please sign in first, then reconnect GitHub.');
      return;
    }
    if (providerError) {
      finishError(
        errorDescription
          ? `GitHub authorization was not completed: ${errorDescription}`
          : 'GitHub authorization was not completed.'
      );
      return;
    }
    if (!code) {
      finishError('Missing authorization code from GitHub.');
      return;
    }
    if (!state) {
      finishError('Missing verification state. Restart the connection from the dashboard.');
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const session = (await getSupabaseClient().auth.getSession()).data.session;
        if (!session?.access_token) {
          finishError('Please sign in first, then reconnect GitHub.');
          return;
        }
        const res = await fetch('/api/github/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          // Flow A: code + state ONLY. No installation id is ever sent —
          // the server resolves installations from GitHub itself.
          body: JSON.stringify({ code, state }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          status?: string;
          installations?: EligibleInstallation[];
        };
        if (!res.ok) {
          finishError(body.error || 'GitHub connection failed. Please retry from the dashboard.');
          return;
        }
        if (body.status === 'selection_required' && body.installations?.length) {
          setOutcome({ state: 'select', installations: body.installations });
          return;
        }
        setOutcome({ state: 'success' });
        setTimeout(() => {
          void navigate('/dashboard/github?connect=success');
        }, 1200);
      } catch {
        finishError('GitHub connection failed. Please retry from the dashboard.');
      }
    })();
  }, [auth, navigate]);

  const handleChoose = (installation: EligibleInstallation) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setOutcome({ state: 'processing' });
    void (async () => {
      const ok = await connectWithToken(installation.selectionToken);
      if (!ok) return;
      setOutcome({ state: 'success' });
      setTimeout(() => {
        void navigate('/dashboard/github?connect=success');
      }, 1200);
    })();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {outcome.state === 'processing' && (
          <>
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"
              role="status"
              aria-label="Connecting GitHub"
            />
            <h1 className="text-xl font-semibold mb-2">Connecting GitHub…</h1>
            <p className="text-gray-600">Verifying your installation with GitHub.</p>
          </>
        )}
        {outcome.state === 'select' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Choose an account</h1>
            <p className="text-gray-600 mb-4">
              Your GitHub account can access more than one installation of this app. Pick the one to
              connect.
            </p>
            <ul className="space-y-2">
              {outcome.installations.map((installation) => (
                <li key={installation.installationId}>
                  <button
                    type="button"
                    onClick={() => handleChoose(installation)}
                    className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm hover:bg-gray-50">
                    Connect <strong>{installation.accountLogin}</strong>
                    {installation.accountType === 'Organization' ? ' (organization)' : ''}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {outcome.state === 'success' && (
          <>
            <div className="text-4xl mb-4" aria-hidden="true">
              ✓
            </div>
            <h1 className="text-xl font-semibold mb-2">GitHub connected</h1>
            <p className="text-gray-600">Returning you to the dashboard…</p>
          </>
        )}
        {outcome.state === 'error' && (
          <>
            <div className="text-4xl mb-4" aria-hidden="true">
              ⚠
            </div>
            <h1 className="text-xl font-semibold mb-2">Could not connect GitHub</h1>
            <p className="text-gray-600">{outcome.message}</p>
          </>
        )}
      </div>
    </div>
  );
}

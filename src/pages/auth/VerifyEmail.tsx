import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth/context';
import { getSupabaseClient } from '../../lib/supabase/client';
import { toSafeAuthMessage } from '../../lib/auth/errors';
import { useNoindexMeta } from '../../lib/seo/usePageMeta';

export default function VerifyEmail() {
  useNoindexMeta('Verify your email — CVentory');

  const auth = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  // QA-008: the button must NEVER look like a silent no-op. One of three
  // explicit outcomes is always shown after a check.
  const [feedback, setFeedback] = useState<'none' | 'not_yet' | 'error'>('none');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === 'authenticated' && auth.user.emailConfirmed) {
      void navigate('/dashboard', { replace: true });
    }
  }, [auth, navigate]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          setVerified(true);
        }
      }
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) {
        setVerified(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (verified) {
      void navigate('/dashboard', { replace: true });
    }
  }, [verified, navigate]);

  const handleCheckVerification = async () => {
    setChecking(true);
    setFeedback('none');
    setErrorDetail(null);
    try {
      // Refresh the user so a just-clicked verification link is reflected.
      // (refreshUser resolves without throwing even when the fetch fails;
      // the getUser probe below decides the outcome.)
      await auth.refreshUser();
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          setFeedback('error');
          setErrorDetail(toSafeAuthMessage(userError.message));
          return;
        }
        if (user?.email_confirmed_at) {
          setVerified(true);
          return;
        }
      }
      // Explicit still-unverified outcome — no silent no-op.
      setFeedback('not_yet');
    } catch {
      setFeedback('error');
      setErrorDetail('Could not check verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  if (auth.status === 'authenticated' && auth.user.emailConfirmed) {
    return null;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-4">Verify your email</h1>
        <p className="text-gray-600 mb-6">
          We've sent a verification link to your email address. Please check your inbox and click
          the link to verify your account.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => void handleCheckVerification()}
            disabled={checking}
            className="w-full bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
            {checking ? 'Checking…' : "I've verified my email"}
          </button>

          {feedback === 'not_yet' && (
            <p
              className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
              role="status">
              We still can't see the verification yet. If you just clicked the link, wait a few
              seconds and try again.
            </p>
          )}
          {feedback === 'error' && (
            <p className="text-sm text-red-600" role="alert">
              {errorDetail ?? 'Could not check verification status. Please try again.'}
            </p>
          )}

          <p className="text-sm text-gray-500">
            Didn't receive the email? Check your spam folder or{' '}
            <button
              onClick={() => void handleCheckVerification()}
              className="text-gray-900 hover:underline">
              try again
            </button>
          </p>
        </div>

        <div className="mt-6">
          <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

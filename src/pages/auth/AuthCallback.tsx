import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { getSupabaseClient } from '../../lib/supabase/client';
import { useNoindexMeta } from '../../lib/seo/usePageMeta';
import { track } from '../../lib/analytics/events';

export default function AuthCallback() {
  useNoindexMeta('Signing in — CVentory');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const handleCallback = async () => {
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setErrorMessage(errorDescription || error);
        return;
      }

      if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'signup' | 'magiclink' | 'recovery',
        });

        if (verifyError) {
          setStatus('error');
          setErrorMessage(verifyError.message);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.email_confirmed_at) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!profileError && profile) {
            void navigate('/dashboard', { replace: true });
          } else {
            // First confirmed login with no profile yet = completed signup.
            track('signup_completed', { source: 'email_confirm' });
            void navigate('/onboarding', { replace: true });
          }
          return;
        }
      }

      void navigate('/verify-email', { replace: true });
    };

    void handleCallback();
  }, [navigate, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-4">Verification failed</h1>
        <p className="text-gray-600 mb-6">{errorMessage || 'Unable to verify your email.'}</p>
        <a
          href="/login"
          className="inline-block bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800">
          Go to sign in
        </a>
      </div>
    </div>
  );
}

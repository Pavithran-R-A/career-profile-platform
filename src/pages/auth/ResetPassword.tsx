import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth/context';
import { getSupabaseClient } from '../../lib/supabase/client';
import { toSafeAuthMessage } from '../../lib/auth/errors';
import { useNoindexMeta } from '../../lib/seo/usePageMeta';

type SessionState = 'checking' | 'recovery' | 'none';

export default function ResetPassword() {
  useNoindexMeta('Reset password — CVentory');

  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  // Guard (QA-003): the reset form requires an authenticated session — which
  // normally exists only after the recovery link's callback. Without one, the
  // user sees the invalid-link state, never a form that would leak
  // "Auth session missing!" on submit.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) setSessionState(session?.user ? 'recovery' : 'none');
      } catch {
        if (!cancelled) setSessionState('none');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error: authError } = await auth.updatePassword({ password });
    setLoading(false);

    if (authError) {
      setError(toSafeAuthMessage(authError.message));
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      void navigate('/dashboard');
    }, 2000);
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleFormSubmit = (e: FormEvent) => {
    void handleSubmit(e);
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-4">Password updated</h1>
          <p className="text-gray-600 mb-6">Your password has been successfully updated.</p>
          <Link to="/dashboard" className="text-gray-900 font-medium hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (sessionState === 'checking') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <p className="text-gray-500" role="status">
          Checking your reset link…
        </p>
      </div>
    );
  }

  if (sessionState === 'none') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-4">Reset your password</h1>
          <p className="text-gray-600 mb-6">This password-reset link is invalid or has expired.</p>
          <Link
            to="/forgot-password"
            className="inline-block bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-center mb-8">Reset your password</h1>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={handleTogglePassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}

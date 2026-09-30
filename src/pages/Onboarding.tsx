import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService, safeProfileErrorMessage } from '../lib/profiles/service';
import { validateUsername } from '../lib/validators/username';
import { useNoindexMeta } from '../lib/seo/usePageMeta';
import { track } from '../lib/analytics/events';

type OnboardingStep = 'username' | 'basics' | 'complete';

export default function Onboarding() {
  useNoindexMeta('Set up your profile — Career Profile');
  const auth = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>('username');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [location, setLocation] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const profileServiceRef = useRef<ProfileService | null>(null);
  if (!profileServiceRef.current) profileServiceRef.current = new ProfileService();
  const profileService = profileServiceRef.current;

  useEffect(() => {
    if (auth.status === 'authenticated' && auth.user.emailConfirmed) {
      setDisplayName(auth.user.email?.split('@')[0] || '');
    }
  }, [auth]);

  const checkUsername = async (value: string) => {
    const validation = validateUsername(value);
    if (!validation.valid) {
      setUsernameError(validation.error);
      setUsernameAvailable(false);
      return;
    }

    setCheckingUsername(true);
    const result = await profileService.checkUsernameAvailability(validation.username);
    setCheckingUsername(false);
    setUsernameAvailable(result.available);
    setUsernameError(result.error);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    void checkUsername(value);
  };

  const handleUsernameSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!usernameAvailable || checkingUsername) return;

    setStep('basics');
  };

  const handleBasicsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (auth.status !== 'authenticated') return;

    setLoading(true);
    setError(null);

    try {
      // ATOMIC create: user_id, username, display_name, headline, about and
      // location persist in ONE statement (RPC). If a previous attempt left a
      // partial profile, this resumes/updates it instead of duplicating.
      // null = the username is taken by someone else.
      const profileId = await profileService.createProfileWithBasics({
        userId: auth.user.id,
        username,
        displayName: displayName.trim(),
        headline: headline.trim(),
        about: about.trim(),
        location: location.trim(),
      });
      if (profileId === null) {
        setError('Username is already taken. Please choose another.');
        // The alert div renders inside the basics form; going back to the
        // username step must ALSO surface the reason there, or the customer
        // sees the step change with no explanation.
        setUsernameError('Username is already taken. Please choose another.');
        setUsernameAvailable(false);
        setStep('username');
        return;
      }
      track('profile_created', { source: 'onboarding' });
      setStep('complete');
      setTimeout(() => {
        void navigate('/dashboard');
      }, 1500);
    } catch (err) {
      // Customer-safe mapper: raw database error text never reaches the UI.
      setError(safeProfileErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    void handleBasicsSubmit(e);
  };

  if (auth.status !== 'authenticated') {
    return null;
  }

  const stepIndex = step === 'username' ? 0 : step === 'basics' ? 1 : 2;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <ol className="flex items-center gap-2 mb-8" aria-label="Setup progress">
          {['Profile URL', 'Basics', 'Done'].map((label, index) => (
            <li key={label} className="flex-1">
              <span
                className={`block h-1.5 rounded-full ${index <= stepIndex ? 'bg-gray-900' : 'bg-gray-200'}`}
                aria-hidden="true"
              />
              <span
                className={`mt-1.5 block text-[11px] font-medium ${index <= stepIndex ? 'text-gray-900' : 'text-gray-400'}`}
                aria-current={index === stepIndex ? 'step' : undefined}>
                {label}
              </span>
            </li>
          ))}
        </ol>
        {step === 'username' && (
          <>
            <h1 className="text-2xl font-semibold text-center mb-4">Choose your profile URL</h1>
            <p className="text-center text-gray-600 mb-8">
              This will be your public profile address when published.
            </p>

            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  Profile URL
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">yourname.</span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                {usernameError && <p className="text-red-600 text-sm mt-1">{usernameError}</p>}
                {usernameAvailable && (
                  <p className="text-green-600 text-sm mt-1">Username is available</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!usernameAvailable || checkingUsername}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                Continue
              </button>
            </form>
          </>
        )}

        {step === 'basics' && (
          <>
            <h1 className="text-2xl font-semibold text-center mb-4">Basic information</h1>
            <p className="text-center text-gray-600 mb-8">
              Tell us a bit about yourself. You can always edit this later.
            </p>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="headline" className="block text-sm font-medium mb-1">
                  Headline
                </label>
                <input
                  id="headline"
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g., Software Engineer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="about" className="block text-sm font-medium mb-1">
                  About
                </label>
                <textarea
                  id="about"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium mb-1">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., San Francisco, CA"
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
                {loading ? 'Creating profile...' : 'Complete setup'}
              </button>
            </form>
          </>
        )}

        {step === 'complete' && (
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-4">Profile created!</h1>
            <p className="text-gray-600">Redirecting you to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}

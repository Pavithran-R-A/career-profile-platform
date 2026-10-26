import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { AuthProvider } from '../../lib/auth/context';
import Signup from '../../pages/auth/Signup';
import ForgotPassword from '../../pages/auth/ForgotPassword';
import VerifyEmail from '../../pages/auth/VerifyEmail';
import { FAKE_PASSWORD } from '../fixtures/fake-values';
import ResetPassword from '../../pages/auth/ResetPassword';
import AuthCallback from '../../pages/auth/AuthCallback';
import Login from '../../pages/auth/Login';

// Real email delivery needs the production SMTP sender (owner-configured), so
// every provider interaction here is mocked. What IS validated is the
// customer-facing contract around those calls: redirect targets baked into
// the email links, resend/verify feedback, expiry handling, callback routing
// and provider-error sanitisation.
vi.mock('../../lib/analytics/events', () => ({ track: vi.fn() }));

type AuthMock = {
  signUp: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  resetPasswordForEmail: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
  resend: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
};

const supabaseMock = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    verifyOtp: vi.fn(),
    resend: vi.fn(),
    onAuthStateChange: vi.fn(),
  } as unknown as AuthMock,
  from: vi.fn(),
};

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => supabaseMock,
}));

const ORIGIN = window.location.origin;

const noSession = () => ({ data: { session: null } });
const pendingSession = () => ({
  data: {
    session: {
      user: { id: 'user-1', email: 'qa@example.test', email_confirmed_at: null },
    },
  },
});
const confirmedSession = () => ({
  data: {
    session: {
      user: {
        id: 'user-1',
        email: 'qa@example.test',
        email_confirmed_at: '2026-10-17T00:00:00Z',
      },
    },
  },
});

function profilesReturning(profile: { id: string } | null) {
  supabaseMock.from.mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: profile, error: null }) }),
    }),
  });
}

function LocationProbe() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;
  return (
    <div data-testid="location">
      {location.pathname + location.search + (email ? `|${email}` : '')}
    </div>
  );
}

function renderPage(ui: ReactElement, path = '/') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </AuthProvider>
  );
}

const VALID_PASSWORD = FAKE_PASSWORD;

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.auth.getSession.mockResolvedValue(noSession());
  supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  supabaseMock.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  supabaseMock.auth.signUp.mockResolvedValue({ error: null });
  supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  supabaseMock.auth.updateUser.mockResolvedValue({ error: null });
  supabaseMock.auth.verifyOtp.mockResolvedValue({ error: null });
  supabaseMock.auth.resend.mockResolvedValue({ error: null });
});

describe('signup email flow', () => {
  it('signs up with the /auth/callback redirect baked into the confirmation email link', async () => {
    renderPage(<Signup />, '/signup');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: VALID_PASSWORD } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: VALID_PASSWORD },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /create account|sign up|create your account/i })
    );

    await waitFor(() =>
      expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.test',
        password: VALID_PASSWORD,
        options: { emailRedirectTo: `${ORIGIN}/auth/callback` },
      })
    );
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/verify-email'));
    // The address travels with the redirect so the verify page can offer resend.
    expect(screen.getByTestId('location')).toHaveTextContent('new@example.test');
  });

  it('rejects mismatched passwords before contacting the provider', async () => {
    renderPage(<Signup />, '/signup');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: VALID_PASSWORD } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'Different!Pass1' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /create account|sign up|create your account/i })
    );

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });

  it('surfaces the provider error on the form (already-registered account)', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({
      error: { message: 'User already registered', code: 'user_already_exists' },
    });
    renderPage(<Signup />, '/signup');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dup@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: VALID_PASSWORD } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: VALID_PASSWORD },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /create account|sign up|create your account/i })
    );

    expect(await screen.findByText('User already registered')).toBeInTheDocument();
  });
});

describe('resend confirmation / verify-email flow', () => {
  it('always reports an explicit still-unverified outcome (never a silent no-op)', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { email_confirmed_at: null } },
      error: null,
    });
    renderPage(<VerifyEmail />, '/verify-email');
    fireEvent.click(await screen.findByRole('button', { name: "I've verified my email" }));

    expect(await screen.findByText(/still can't see the verification yet/i)).toBeInTheDocument();
  });

  it('routes to the dashboard once the click-through verification is visible', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { email_confirmed_at: '2026-10-17T00:00:01Z' } },
      error: null,
    });
    renderPage(<VerifyEmail />, '/verify-email');
    fireEvent.click(await screen.findByRole('button', { name: "I've verified my email" }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
  });

  it('resends the confirmation email to the signup address with an explicit outcome', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/verify-email', state: { email: 'new@example.test' } }]}>
          <VerifyEmail />
          <LocationProbe />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: /resend confirmation email/i }));
    await waitFor(() =>
      // The resent link must route through the same callback as signup —
      // without emailRedirectTo, Supabase falls back to the Site URL root.
      expect(supabaseMock.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'new@example.test',
        options: { emailRedirectTo: `${ORIGIN}/auth/callback` },
      })
    );
    expect(await screen.findByText(/confirmation email resent/i)).toBeInTheDocument();
  });

  it('reports a resend failure instead of failing silently', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    supabaseMock.auth.resend.mockResolvedValue({ error: { message: 'rate limit exceeded' } });
    render(
      <AuthProvider>
        <MemoryRouter
          initialEntries={[{ pathname: '/verify-email', state: { email: 'new@example.test' } }]}>
          <VerifyEmail />
          <LocationProbe />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: /resend confirmation email/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't resend/i);
  });

  it('shows an alert (not raw provider text) when the verification check fails', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth session missing!' },
    });
    renderPage(<VerifyEmail />, '/verify-email');
    fireEvent.click(await screen.findByRole('button', { name: "I've verified my email" }));

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/jwt|pgrst|postgres|sqlstate/i);
  });
});

describe('password reset email flow', () => {
  it('requests the reset with the /reset-password redirect and confirms truthfully', async () => {
    renderPage(<ForgotPassword />, '/forgot-password');
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() =>
      expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.test', {
        redirectTo: `${ORIGIN}/reset-password`,
      })
    );
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText(/user@example\.test/)).toBeInTheDocument();
  });

  it('shows a safe alert when the reset request fails', async () => {
    supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'Invalid JWT: pgrst-000' },
    });
    renderPage(<ForgotPassword />, '/forgot-password');
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/jwt|pgrst|postgres/i);
  });

  it('shows the invalid/expired link state when no recovery session exists', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(noSession());
    renderPage(<ResetPassword />, '/reset-password');

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new reset link/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
  });

  it('updates the password through a valid recovery session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    renderPage(<ResetPassword />, '/reset-password');

    fireEvent.change(await screen.findByLabelText('New Password'), {
      target: { value: VALID_PASSWORD },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: VALID_PASSWORD },
    });
    fireEvent.click(screen.getByRole('button', { name: /update password|reset password/i }));

    await waitFor(() =>
      expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
        password: VALID_PASSWORD,
      })
    );
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
  });

  it('rejects a weak new password before contacting the provider', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    renderPage(<ResetPassword />, '/reset-password');

    fireEvent.change(await screen.findByLabelText('New Password'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update password|reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/at least 12 characters/i);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('sanitises an expired-session error on update (expiry path)', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    supabaseMock.auth.updateUser.mockResolvedValue({
      error: { message: 'invalid JWT: token expired' },
    });
    renderPage(<ResetPassword />, '/reset-password');

    fireEvent.change(await screen.findByLabelText('New Password'), {
      target: { value: VALID_PASSWORD },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: VALID_PASSWORD },
    });
    fireEvent.click(screen.getByRole('button', { name: /update password|reset password/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/jwt|token expired|pgrst/i);
  });
});

describe('auth callback (email link landing)', () => {
  it('shows safe fixed copy for an expired email callback link', async () => {
    renderPage(
      <AuthCallback />,
      '/auth/callback?error=access_denied&error_description=Link%20expired'
    );

    expect(await screen.findByText('Verification failed')).toBeInTheDocument();
    expect(screen.getByText('This link is invalid or has expired.')).toBeInTheDocument();
  });

  it('never reflects an untrusted callback error description from the URL', async () => {
    renderPage(
      <AuthCallback />,
      '/auth/callback?error=access_denied&error_description=Internal%20DB%20connection%20host%3D10.0.0.12'
    );

    expect(await screen.findByText('Verification failed')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    const callbackContent = screen.getByText('Verification failed').parentElement?.textContent;
    expect(callbackContent).not.toContain('10.0.0.12');
  });

  it('verifies the token hash with the emailed type', async () => {
    supabaseMock.auth.verifyOtp.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    });
    renderPage(<AuthCallback />, '/auth/callback?token_hash=abc123&type=signup');

    await waitFor(() =>
      expect(supabaseMock.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'abc123',
        type: 'signup',
      })
    );
    expect(await screen.findByText('Verification failed')).toBeInTheDocument();
    expect(screen.getByText('This link is invalid or has expired.')).toBeInTheDocument();
  });

  it('sends a first confirmed login without a profile to onboarding', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(confirmedSession());
    supabaseMock.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'qa@example.test',
          email_confirmed_at: '2026-10-17T00:00:00Z',
        },
      },
      error: null,
    });
    profilesReturning(null);
    renderPage(<AuthCallback />, '/auth/callback?token_hash=abc123&type=signup');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/onboarding'));
  });

  it('sends a confirmed login with an existing profile to the dashboard', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(confirmedSession());
    supabaseMock.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'qa@example.test',
          email_confirmed_at: '2026-10-17T00:00:00Z',
        },
      },
      error: null,
    });
    profilesReturning({ id: 'profile-id' });
    renderPage(<AuthCallback />, '/auth/callback?token_hash=abc123&type=signup');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
  });

  it('bounces an unconfirmed visitor to the verify-email page', async () => {
    supabaseMock.auth.getSession.mockResolvedValue(pendingSession());
    renderPage(<AuthCallback />, '/auth/callback?token_hash=abc123&type=signup');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/verify-email'));
  });
});

describe('sign-in error sanitisation (leak regression)', () => {
  it('never renders raw provider/DB internals from a failed sign-in', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid JWT: pgrst-000 relation "users" missing' },
    });
    renderPage(<Login />, '/login');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.test' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
      target: { value: VALID_PASSWORD },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/jwt|pgrst|relation|sqlstate/i);
  });
});

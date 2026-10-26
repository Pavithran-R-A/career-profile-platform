import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AccountDelete from '../../pages/AccountDelete';

/**
 * Live QA regression (deployed acceptance against SHA 6243735):
 * after a successful deletion the flow signs the session out BEFORE showing
 * the success state. An auth-first render order hid the "Account deleted"
 * confirmation and bounced the customer to the sign-in prompt instead.
 * The terminal success state must render regardless of the now-unauthenticated
 * session, because the page itself schedules "Redirecting you home…".
 */

const harness = vi.hoisted(() => {
  const authState: { status: string; user: { id: string; email: string } | null } = {
    status: 'authenticated',
    user: { id: 'user-A', email: 'qa@example.test' },
  };
  const signOut = vi.fn(async () => {
    authState.status = 'unauthenticated';
    authState.user = null;
    return { error: null };
  });
  const signInWithPassword = vi.fn(async () => ({
    data: { user: { id: 'user-A' } },
    error: null,
  }));
  const getSession = vi.fn(async () => ({
    data: { session: { access_token: 'fresh-token' } },
  }));
  return { authState, signOut, signInWithPassword, getSession };
});

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => harness.authState,
}));

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: harness.signInWithPassword,
      getSession: harness.getSession,
      signOut: harness.signOut,
    },
  }),
}));

beforeEach(() => {
  harness.authState.status = 'authenticated';
  harness.authState.user = { id: 'user-A', email: 'qa@example.test' };
  harness.signOut.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({}) }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(<AccountDelete />, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });
}

describe('account deletion confirmation (live regression)', () => {
  it('shows "Account deleted" after sign-out so the confirmation is never hidden', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/Type DELETE to continue/), {
      target: { value: 'DELETE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
    expect(await screen.findByRole('heading', { name: "Confirm it's you" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'qa@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in and delete my account' }));

    // The flow signs out on success — the session must be gone…
    await waitFor(() => {
      expect(harness.signOut).toHaveBeenCalled();
    });
    expect(harness.authState.status).toBe('unauthenticated');

    // …yet the customer still gets the confirmation (regression: this used to
    // render the signed-out "Sign in" card instead and never showed it).
    expect(await screen.findByRole('heading', { name: 'Account deleted' })).toBeInTheDocument();
    expect(screen.getByText(/Redirecting you home/)).toBeInTheDocument();
  });
});

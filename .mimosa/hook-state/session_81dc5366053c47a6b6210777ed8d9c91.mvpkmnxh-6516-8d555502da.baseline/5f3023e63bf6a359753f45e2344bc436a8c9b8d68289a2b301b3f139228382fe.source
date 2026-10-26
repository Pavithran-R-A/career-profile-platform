import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Onboarding from '../../pages/Onboarding';

// track() is fire-and-forget but resolves the real supabase client; stub it
// so no network attempt races the assertions.
vi.mock('../../lib/analytics/events', () => ({
  track: vi.fn(),
}));

// Mock the service class: Onboarding now uses the ATOMIC
// createProfileWithBasics RPC path (one insert with all basics), not the old
// createProfile → updateProfile two-step that could leave partial profiles.
const createProfileWithBasics = vi.fn();

const stableAuth = {
  status: 'authenticated',
  user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
};

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => stableAuth,
}));

import { ProfileAppError } from '../../lib/profiles/repository';

vi.mock('../../lib/profiles/service', () => ({
  ProfileService: class {
    checkUsernameAvailability = vi.fn().mockResolvedValue({ available: true, error: null });
    createProfileWithBasics = createProfileWithBasics;
    getProfile = vi.fn().mockResolvedValue(null);
  },
  // Mirror the REAL mapper's contract: customer-safe, no raw DB text.
  safeProfileErrorMessage: (err: unknown) =>
    err instanceof ProfileAppError ? err.message : 'Something went wrong. Please try again.',
}));

describe('Onboarding basics persistence (atomic create)', () => {
  beforeEach(() => {
    createProfileWithBasics.mockReset();
    createProfileWithBasics.mockResolvedValue('profile-id');
  });

  it('creates the profile with ALL basics in ONE call', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Onboarding />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Profile URL'), { target: { value: 'synthetic' } });
    await waitFor(() => expect(screen.getByText('Continue')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Continue'));

    fireEvent.change(screen.getByLabelText('Display Name'), {
      target: { value: 'Synthetic Candidate' },
    });
    fireEvent.change(screen.getByLabelText('Headline'), {
      target: { value: 'Software Engineer' },
    });
    fireEvent.change(screen.getByLabelText('About'), {
      target: { value: 'Built reliable software.' },
    });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Test City' } });
    fireEvent.click(screen.getByText('Complete setup'));

    await waitFor(() => expect(createProfileWithBasics).toHaveBeenCalledTimes(1));
    expect(createProfileWithBasics).toHaveBeenCalledWith({
      userId: 'user-1',
      username: 'synthetic',
      displayName: 'Synthetic Candidate',
      headline: 'Software Engineer',
      about: 'Built reliable software.',
      location: 'Test City',
    });
    expect(await screen.findByText('Profile created!')).toBeInTheDocument();
  });

  it('shows a truthful error and stays on username step when the username was taken meanwhile', async () => {
    createProfileWithBasics.mockResolvedValue(null); // RPC: username taken

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Onboarding />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Profile URL'), { target: { value: 'synthetic' } });
    await waitFor(() => expect(screen.getByText('Continue')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Continue'));
    // Required field must be filled for jsdom constraint validation.
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Synthetic' } });
    fireEvent.click(screen.getByText('Complete setup'));

    expect(
      await screen.findByText('Username is already taken. Please choose another.')
    ).toBeInTheDocument();
  });

  it('maps failures to customer-safe messages (no raw DB text)', async () => {
    createProfileWithBasics.mockRejectedValue(
      new Error('duplicate key value violates unique constraint')
    );

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Onboarding />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Profile URL'), { target: { value: 'synthetic' } });
    await waitFor(() => expect(screen.getByText('Continue')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Synthetic' } });
    fireEvent.click(screen.getByText('Complete setup'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('duplicate key');
  });
});

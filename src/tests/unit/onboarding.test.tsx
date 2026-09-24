import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Onboarding from '../../pages/Onboarding';

const createProfile = vi.fn();
const updateProfile = vi.fn();

const stableAuth = {
  status: 'authenticated',
  user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
};

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('../../lib/profiles/service', () => ({
  ProfileService: class {
    checkUsernameAvailability = vi.fn().mockResolvedValue({ available: true, error: null });
    createProfile = createProfile.mockResolvedValue({ id: 'profile-id' });
    updateProfile = updateProfile.mockResolvedValue(undefined);
    getProfile = vi.fn().mockResolvedValue(null);
  },
}));

describe('Onboarding basics persistence', () => {
  it('persists display name, headline, about and location after creating the profile', async () => {
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

    await waitFor(() => expect(createProfile).toHaveBeenCalledWith('user-1', 'synthetic'));
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith('profile-id', {
        display_name: 'Synthetic Candidate',
        headline: 'Software Engineer',
        about: 'Built reliable software.',
        location: 'Test City',
      })
    );
    expect(await screen.findByText('Profile created!')).toBeInTheDocument();
  });
});

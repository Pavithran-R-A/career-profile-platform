import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import GitHubCallback from '../../pages/GitHubCallback';

// Stable identity: GitHubCallback's effect depends on `auth`, so a fresh
// object per call would re-run the effect forever and hang the run.
const stableAuth = {
  status: 'authenticated',
  user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
};

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  }),
}));

/**
 * PR #7 made /auth/callback fail closed on untrusted URL error text; the
 * GitHub OAuth denial path had the same reflection defect —
 * `error_description` from the query string was interpolated into visible
 * copy. This guard pins the fixed-copy classification for that path.
 */
describe('GitHub callback error rendering (URL reflection)', () => {
  it('never reflects a crafted error_description from the URL', async () => {
    window.history.pushState(
      {},
      '',
      '/dashboard/github/callback?error=access_denied&error_description=Denied%20on%20host%2010.9.9.9%20trace=XYZ'
    );

    render(
      <MemoryRouter initialEntries={['/dashboard/github/callback']}>
        <GitHubCallback />
      </MemoryRouter>
    );

    expect(await screen.findByText(/GitHub authorization was cancelled/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('10.9.9.9');
    expect(document.body.textContent).not.toContain('trace=XYZ');
  });

  it('uses fixed copy for unrecognized provider error codes', async () => {
    window.history.pushState(
      {},
      '',
      '/dashboard/github/callback?error=server_error&error_description=Internal%20DB%20host%3D10.0.0.12'
    );

    render(
      <MemoryRouter initialEntries={['/dashboard/github/callback']}>
        <GitHubCallback />
      </MemoryRouter>
    );

    expect(await screen.findByText('GitHub authorization was not completed.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('10.0.0.12');
  });
});

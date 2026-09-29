import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ProfileEditor from '../../pages/ProfileEditor';

const stableAuth = {
  status: 'authenticated',
  user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
};

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => stableAuth,
}));

function makeProfile() {
  return {
    id: 'profile-id',
    user_id: 'user-1',
    username: 'synthetic',
    display_name: 'Synthetic Candidate',
    headline: 'Engineer',
    about: null,
    location: null,
    avatar_url: null,
    visibility: 'draft',
    published_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    experiences: [
      {
        id: 'exp-1',
        profile_id: 'profile-id',
        company: 'Example Works',
        role: 'Senior Developer',
        location: null,
        start_year: 2021,
        start_month: 3,
        end_year: null,
        end_month: null,
        is_current: true,
        description: 'Built things.',
        sort_order: 0,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'exp-2',
        profile_id: 'profile-id',
        company: 'Beta Corp',
        role: 'Developer',
        location: null,
        start_year: 2018,
        start_month: null,
        end_year: 2021,
        end_month: 2,
        is_current: false,
        description: null,
        sort_order: 1,
        created_at: '',
        updated_at: '',
      },
    ],
    education: [],
    skills: [],
    projects: [],
    links: [],
  };
}

let profileFixture = makeProfile();

vi.mock('../../lib/profiles/service', () => ({
  ProfileService: class {
    getProfile = vi.fn(() => Promise.resolve(profileFixture));
    updateProfile = vi.fn(() => Promise.resolve());
  },
}));

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}));

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/profile']}>
      <ProfileEditor />
    </MemoryRouter>
  );
}

describe('ProfileEditor existing records', () => {
  it('offers Edit as the primary action with subtle delete and move controls', async () => {
    profileFixture = makeProfile();
    renderEditor();

    // open Experience section (profile fetch is async)
    fireEvent.click(await screen.findByRole('button', { name: 'Experience' }));

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
    expect(editButtons).toHaveLength(2);
    // delete is an icon button with a descriptive aria-label, not a dominant red link
    const deleteButtons = await screen.findAllByLabelText(/Delete Senior Developer/);
    expect(deleteButtons).toHaveLength(1);
    expect((await screen.findAllByRole('button', { name: 'Move up' })).length).toBeGreaterThan(0);
    expect((await screen.findAllByRole('button', { name: 'Move down' })).length).toBeGreaterThan(0);
    // no dominant red Delete text link
    expect(screen.queryByRole('button', { name: /^Delete$/ })).not.toBeInTheDocument();
  });

  it('opens an inline editor when Edit is pressed', async () => {
    profileFixture = makeProfile();
    renderEditor();
    fireEvent.click(await screen.findByRole('button', { name: 'Experience' }));
    const editBtns = await screen.findAllByRole('button', { name: 'Edit' });
    fireEvent.click(editBtns[0]);
    expect(screen.getByText('Editing role')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // prefilled with existing data
    expect(screen.getByDisplayValue('Senior Developer')).toBeInTheDocument();
    // month select instead of raw number for start month (inline edit form, listed first)
    const startMonths = screen.getAllByLabelText('startMonth');
    expect(startMonths.length).toBeGreaterThan(0);
    expect(startMonths[0].tagName).toBe('SELECT');
  });

  it('shows explanatory empty states for sections with no data', async () => {
    profileFixture = makeProfile();
    renderEditor();

    fireEvent.click(await screen.findByRole('button', { name: 'Projects' }));
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText(/live link makes a difference/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(await screen.findByText('No skills yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    expect(await screen.findByText('No links yet')).toBeInTheDocument();
  });
});

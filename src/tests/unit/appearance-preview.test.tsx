import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AppearanceEditor from '../../pages/AppearanceEditor';
import { ensureTemplatesRegistered } from '../../lib/templates/registry';
import type * as PreferencesModule from '../../lib/profiles/preferences';

ensureTemplatesRegistered();

const stableAuth = {
  status: 'authenticated',
  user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
};

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => stableAuth,
}));

const profileFixture = {
  id: 'profile-id',
  user_id: 'user-1',
  username: 'synthetic',
  display_name: 'Synthetic Candidate',
  headline: 'Software Engineer',
  about: 'Built reliable software.',
  location: 'Test City',
  avatar_url: null,
  visibility: 'draft',
  published_at: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  experiences: [],
  education: [],
  skills: [
    {
      id: 'skill-1',
      profile_id: 'profile-id',
      name: 'TypeScript',
      category: null,
      sort_order: 0,
      created_at: '',
      updated_at: '',
    },
  ],
  projects: [],
  links: [],
};

let prefsFixture = {
  id: 'prefs-id',
  profile_id: 'profile-id',
  template_key: 'technical',
  accent_key: 'blue',
  section_order: ['basics', 'experience', 'education', 'projects', 'skills', 'links'],
  hidden_sections: [],
};

vi.mock('../../lib/profiles/service', () => ({
  ProfileService: class {
    getProfile = vi.fn().mockResolvedValue(profileFixture);
  },
}));

vi.mock('../../lib/profiles/preferences', async (importOriginal) => {
  const original = await importOriginal<typeof PreferencesModule>();
  return {
    ...original,
    getPreferences: vi.fn().mockImplementation(() => Promise.resolve(prefsFixture)),
    updateTemplate: vi.fn().mockResolvedValue({}),
    updateAccent: vi.fn().mockResolvedValue({}),
    updateSectionOrder: vi.fn().mockResolvedValue({}),
    updateHiddenSections: vi.fn().mockResolvedValue({}),
  };
});

describe('AppearanceEditor live preview', () => {
  it('renders the saved template with the owner profile', async () => {
    prefsFixture = { ...prefsFixture, template_key: 'technical' };
    render(
      <MemoryRouter initialEntries={['/dashboard/appearance']}>
        <AppearanceEditor />
      </MemoryRouter>
    );
    expect(await screen.findByText('Live preview')).toBeInTheDocument();
    // Technical template's structured metadata header (location present in fixture)
    expect(await screen.findByText('Test City')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Candidate')).toBeInTheDocument();
  });

  it('follows the saved template key', async () => {
    prefsFixture = { ...prefsFixture, template_key: 'editorial' };
    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard/appearance']}>
        <AppearanceEditor />
      </MemoryRouter>
    );
    expect(await screen.findByText('Live preview')).toBeInTheDocument();
    expect(await screen.findByText('Experience')).toBeInTheDocument();
    unmount();
  });
});

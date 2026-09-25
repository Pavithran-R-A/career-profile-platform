import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../../App';
import TemplateSelector from '../../components/TemplateSelector';
import { ensureTemplatesRegistered } from '../../lib/templates/registry';

ensureTemplatesRegistered();

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => ({ status: 'authenticated', user: { id: 'user-1' } }),
}));

vi.mock('../../lib/profiles/service', () => {
  const profile = {
    id: 'profile-id',
    user_id: 'user-1',
    username: 'synthetic',
    display_name: 'Synthetic Candidate',
    headline: 'Engineer',
    about: 'Built useful things.',
    location: 'Test City',
    avatar_url: null,
    visibility: 'published',
    published_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    experiences: [],
    education: [],
    skills: [],
    projects: [],
    links: [],
  };
  return {
    ProfileService: class {
      getProfile() {
        return Promise.resolve(profile);
      }
    },
  };
});

vi.mock('../../lib/profiles/public', () => ({
  getPublicProfileByUsername: (username: string) =>
    Promise.resolve(
      username === 'published-user'
        ? {
            profile: {
              id: '00000000-0000-4000-8000-000000000001',
              username: 'published-user',
              display_name: 'Published User',
              headline: 'Engineer',
              about: 'Hello world',
              location: null,
              avatar_url: null,
              visibility: 'published',
              published_at: '2026-01-01T00:00:00Z',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              experiences: [],
              education: [],
              skills: [],
              projects: [],
              links: [],
            },
            preferences: {
              template_key: 'minimal',
              accent_key: 'blue',
              section_order: ['about', 'experience', 'education', 'projects', 'skills', 'links'],
              hidden_sections: [],
            },
          }
        : null
    ),
}));

vi.mock('../../lib/profiles/preferences', () => ({
  getPreferences: () =>
    Promise.resolve({
      id: 'prefs-1',
      profile_id: 'profile-id',
      template_key: 'minimal',
      accent_key: 'blue',
      section_order: ['basics', 'experience', 'projects', 'skills', 'education', 'links'],
      hidden_sections: [],
    }),
  updateTemplate: () => Promise.resolve({}),
  updateAccent: () => Promise.resolve({}),
  updateSectionOrder: () => Promise.resolve({}),
  updateHiddenSections: () => Promise.resolve({}),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe('production routes (actual AppRoutes)', () => {
  it('/dashboard/resume/ats renders the ATS builder', async () => {
    renderAt('/dashboard/resume/ats');
    expect(await screen.findByText('ATS resume')).toBeInTheDocument();
    // deterministic inclusion summary with truthful counts (mock profile is empty)
    expect(await screen.findByText(/Included:/)).toBeInTheDocument();
    expect(screen.getByText(/0 roles/)).toBeInTheDocument();
  });

  it('/dashboard/resume/tailor renders JobTailoring', async () => {
    renderAt('/dashboard/resume/tailor');
    expect(await screen.findByText('Job Description Tailoring')).toBeInTheDocument();
  });

  it('/dashboard/preview renders the owner preview', async () => {
    renderAt('/dashboard/preview');
    expect((await screen.findAllByText('Preview')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Published|Draft/)).length).toBeGreaterThan(0);
  });

  it('/u/published-user renders the public profile', async () => {
    renderAt('/u/published-user');
    expect(await screen.findByText('Published User')).toBeInTheDocument();
    expect(await screen.findByText('Hello world')).toBeInTheDocument();
  });

  it('/u/draft-user is unavailable', async () => {
    renderAt('/u/draft-user');
    expect(await screen.findByRole('heading', { name: 'Profile not found' })).toBeInTheDocument();
  });

  it('/dashboard/ats redirects to the canonical ATS route', async () => {
    renderAt('/dashboard/ats');
    expect(await screen.findByText('ATS resume')).toBeInTheDocument();
  });

  it('unknown routes render the 404 page', () => {
    renderAt('/definitely-not-a-route');
    expect(screen.getByText('404')).toBeInTheDocument();
  });
});

describe('template selector (actual registry)', () => {
  it('contains Minimal, Editorial, Technical and never shows the empty state', () => {
    ensureTemplatesRegistered();
    render(<TemplateSelector selectedId="minimal" onSelect={() => undefined} />);
    expect(screen.getAllByText('Minimal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Editorial').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Technical').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText('No templates available.')).not.toBeInTheDocument();
  });
});

describe('dashboard discoverability (actual Dashboard)', () => {
  it('ATS, tailoring and preview actions resolve to canonical routes', async () => {
    renderAt('/dashboard');
    const ats = await screen.findByRole('link', { name: /ATS resume/ });
    const tailor = await screen.findByRole('link', { name: /Job tailoring/ });
    const preview = await screen.findByRole('link', { name: /Preview portfolio/ });
    const profile = await screen.findByRole('link', { name: /Edit profile/ });
    const resume = await screen.findByRole('link', { name: /Import resume/ });
    expect(ats).toHaveAttribute('href', '/dashboard/resume/ats');
    expect(tailor).toHaveAttribute('href', '/dashboard/resume/tailor');
    expect(preview).toHaveAttribute('href', '/dashboard/preview');
    expect(profile).toHaveAttribute('href', '/dashboard/profile');
    expect(resume).toHaveAttribute('href', '/dashboard/resume');
    // meaningful completion details, no repeated "5/5" totals
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getAllByText('No entries yet').length).toBe(2);
    expect(screen.queryByText('0/5')).not.toBeInTheDocument();
    expect(screen.queryByText('5/5')).not.toBeInTheDocument();
  });
});

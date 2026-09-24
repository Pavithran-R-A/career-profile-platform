import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../../App';
import TemplateSelector from '../../components/TemplateSelector';
import { ensureTemplatesRegistered } from '../../lib/templates/registry';

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
            id: '00000000-0000-4000-8000-000000000001',
            user_id: '00000000-0000-4000-8000-000000000002',
            display_name: 'Published User',
            headline: 'Engineer',
            about: 'Hello world',
            location: null,
            avatar_url: null,
            username: 'published-user',
            visibility: 'published',
            published_at: '2026-01-01T00:00:00Z',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          }
        : null
    ),
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
    expect(await screen.findByText('ATS Resume Builder')).toBeInTheDocument();
  });

  it('/dashboard/resume/tailor renders JobTailoring', async () => {
    renderAt('/dashboard/resume/tailor');
    expect(await screen.findByText('Job Description Tailoring')).toBeInTheDocument();
  });

  it('/dashboard/preview renders the owner preview', async () => {
    renderAt('/dashboard/preview');
    expect(await screen.findByRole('heading', { name: 'Preview' })).toBeInTheDocument();
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
    expect(await screen.findByText('ATS Resume Builder')).toBeInTheDocument();
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
  });
});

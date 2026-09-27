import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ResumeImport from '../../pages/ResumeImport';

const stableAuth = {
  status: 'authenticated',
  user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
};

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: 'user-1' }, access_token: 'tok-123' } } }),
    },
  }),
}));

vi.mock('../../lib/profiles/service', () => ({
  ProfileService: class {
    getProfile = vi.fn().mockResolvedValue({ id: 'profile-id' });
  },
}));

vi.mock('../../lib/resume/service', () => ({
  ResumeService: class {
    uploadResume = vi.fn().mockResolvedValue({ id: 'resume-id', storage_path: 'user-1/f.pdf' });
  },
}));

const EXTRACTION = {
  identity: { displayName: 'QA Candidate', headline: null, location: null, avatarUrl: null },
  experience: [],
  education: [],
  projects: [],
  skills: [],
  links: [],
  warnings: [],
};

describe('ResumeImport extract contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends resumeSourceId with a Bearer token, never a raw storage path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(EXTRACTION),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/dashboard/resume']}>
        <ResumeImport />
      </MemoryRouter>
    );

    await screen.findByRole('button', { name: /select pdf/i });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['%PDF-1.4 synthetic'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/resume/extract');
    expect(JSON.parse(init.body as string)).toEqual({ resumeSourceId: 'resume-id' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');

    expect(await screen.findByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText(/QA Candidate/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows a truthful saved-but-unconfigured notice when the provider is off', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'AI extraction is not configured' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/dashboard/resume']}>
        <ResumeImport />
      </MemoryRouter>
    );

    await screen.findByRole('button', { name: /select pdf/i });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['%PDF-1.4 synthetic'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Resume saved.')).toBeInTheDocument();
    expect(
      screen.getByText(/Automatic extraction isn't available on this environment/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

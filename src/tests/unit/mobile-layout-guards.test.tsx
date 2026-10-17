import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TemplateCanvas } from '../../components/portfolio/TemplateCanvas';
import PublicProfile from '../../pages/PublicProfile';
import { ensureTemplatesRegistered } from '../../lib/templates/registry';
import { getPublicProfileByUsername } from '../../lib/profiles/public';
import type * as PublicModule from '../../lib/profiles/public';

vi.mock('../../lib/profiles/public', async (importOriginal) => {
  const original = await importOriginal<typeof PublicModule>();
  return {
    ...original,
    getPublicProfileByUsername: vi.fn(),
  };
});

const mockGetPublic = vi.mocked(getPublicProfileByUsername);

ensureTemplatesRegistered();

const profileFixture = {
  id: 'profile-id',
  user_id: 'user-1',
  username: 'synthetic',
  display_name: 'Synthetic Candidate',
  headline: 'Software Engineer',
  about:
    'Built reliable software. Ends with a very-long-unbroken-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa to force wrapping.',
  location: 'Test City',
  avatar_url: null,
  visibility: 'published' as const,
  published_at: '2026-01-01',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  experiences: [],
  education: [],
  skills: [],
  projects: [],
  links: [],
};

/**
 * Mobile QA (390px) found two CONFIRMED defects on the published portfolio:
 *  1. long unbroken customer tokens widened the page by 70px, and
 *  2. the loading shell (page-shell, 64rem) swapped to the full-bleed
 *     template, dragging the footer (measured CLS 0.304 @1280).
 * These guards pin the mechanisms that fixed them so they cannot regress.
 */
describe('mobile layout guards', () => {
  beforeEach(() => {
    mockGetPublic.mockReset();
  });

  it('TemplateCanvas inner surface wraps unbroken text instead of clipping it', () => {
    const { container } = render(
      <TemplateCanvas
        templateKey="minimal"
        profile={profileFixture}
        scale={0.78}
        height={640}
        label="Test preview"
      />
    );
    const wrappable = container.querySelector('[class*="overflow-wrap"]');
    expect(wrappable).not.toBeNull();
    expect(wrappable!.className).toContain('overflow-wrap:anywhere');
  });

  it('published page loading shell matches the full-bleed envelope and reserves height', async () => {
    mockGetPublic.mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <MemoryRouter initialEntries={['/u/synthetic']}>
        <Routes>
          <Route path="/u/:username" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>
    );
    const status = await screen.findByRole('status', { name: /loading profile/i });
    // Full-bleed: the old page-shell (max-width 64rem) caused the width swap.
    expect(status.className).toContain('w-full');
    expect(status.className).not.toContain('page-shell');
    // Reserved height: the old h-64 block under-reserved the rendered template.
    expect(
      status.querySelector('.skeleton[class*="h-[460px]"], .skeleton[class*="sm:h-[560px]"]')
    ).not.toBeNull();
    // Nothing here should reintroduce a capped shell width.
    expect(container.querySelector('.page-shell')).toBeNull();
  });

  it('loaded published page wraps template text through the shared root', async () => {
    mockGetPublic.mockResolvedValue({
      profile: profileFixture,
      preferences: {
        template_key: 'minimal',
        accent_key: 'blue',
        section_order: ['basics', 'experience', 'education', 'projects', 'skills', 'links'],
        hidden_sections: [],
      },
    } as never);
    const { container } = render(
      <MemoryRouter initialEntries={['/u/synthetic']}>
        <Routes>
          <Route path="/u/:username" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Synthetic Candidate')).toBeInTheDocument());
    expect(container.querySelector('[class*="overflow-wrap"]')).not.toBeNull();
  });
});

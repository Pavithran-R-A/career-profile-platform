import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AppearanceEditor from '../../pages/AppearanceEditor';
import DashboardPreview from '../../pages/DashboardPreview';
import ProfileEditor from '../../pages/ProfileEditor';
import { ensureTemplatesRegistered } from '../../lib/templates/registry';
import type * as PreferencesModule from '../../lib/profiles/preferences';

ensureTemplatesRegistered();

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
  }),
}));

// Profile fetch never resolves so the pages stay in their loading branch.
vi.mock('../../lib/profiles/service', () => ({
  ProfileService: class {
    getProfile = vi.fn().mockReturnValue(new Promise(() => {}));
  },
}));

vi.mock('../../lib/profiles/preferences', async (importOriginal) => {
  const original = await importOriginal<typeof PreferencesModule>();
  return { ...original, getPreferences: vi.fn().mockReturnValue(new Promise(() => {})) };
});

/**
 * Deployed CLS measurement (qa-residual-report.json, build f674ae7) traced the
 * 0.248 @1280px appearance / 0.158 @1536px preview layout shift to ONE
 * mechanism: React reuses the loading branch's root host <div>, and the old
 * loading root carried `.page-shell` (max-width 64rem = 1024px) while the
 * loaded root is wider — so the whole page jumped 1024px -> full width when
 * data resolved. These guards pin the identical loading/loaded envelope so the
 * swap cannot reintroduce the shift.
 */
describe('loading shell envelope guards (CLS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appearance editor loading shell matches the loaded max-w-[1360px] envelope', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/appearance']}>
        <AppearanceEditor />
      </MemoryRouter>
    );
    const status = await screen.findByRole('status', { name: /loading appearance/i });
    expect(status.className).toContain('w-full');
    expect(status.className).toContain('max-w-[1360px]');
    expect(status.className).not.toContain('page-shell');
    // Height reservation: the rendered preview column is chrome + 640px canvas.
    expect(
      status.querySelectorAll('.skeleton[class*="h-[640px]"], .skeleton[class*="h-[680px]"]').length
    ).toBe(2);
  });

  it('private preview loading shell matches the loaded full-bleed envelope', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/preview']}>
        <DashboardPreview />
      </MemoryRouter>
    );
    const status = await screen.findByRole('status', { name: /loading preview/i });
    expect(status.className).toContain('min-h-screen');
    expect(status.className).not.toContain('page-shell');
    // Inner frame mirrors the loaded max-w-5xl toolbar/frame width.
    expect(status.querySelector('.max-w-5xl')).not.toBeNull();
  });

  it('profile editor loading shell matches the loaded max-w-[1360px] envelope', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/profile']}>
        <ProfileEditor />
      </MemoryRouter>
    );
    const status = await screen.findByRole('status', { name: /loading profile editor/i });
    // The role lives on the inner block; the envelope is its root parent.
    const envelope = status.parentElement!;
    expect(envelope.className).toContain('w-full');
    expect(envelope.className).toContain('max-w-[1360px]');
    expect(envelope.className).not.toContain('page-shell');
  });
});

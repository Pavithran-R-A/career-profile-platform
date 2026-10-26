import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import Layout from '../../components/Layout';

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 'user-1', email: 'qa@example.com', emailConfirmed: true },
  }),
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<div>dashboard body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Deployed 390px probe (qa-residual-report.json, build f674ae7) confirmed two
 * mobile navigation defects beyond the working aria-expanded toggle:
 *  1. the toggle's aria-expanded pointed at no addressable region
 *     (aria-controls missing, nav unmounted while closed), and
 *  2. Escape did not close the drawer, and resizing past the lg breakpoint
 *     left aria-expanded="true" against a CSS-hidden nav.
 * These guards pin the disclosure contract that fixed them.
 */
describe('mobile navigation disclosure', () => {
  it('toggle always references a real controlled region via aria-controls', () => {
    renderLayout();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    const region = document.getElementById(controls!);
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('hidden');
  });

  it('opening expands the region and updates the accessible state', () => {
    renderLayout();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(toggle);
    const region = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(region).not.toHaveAttribute('hidden');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Close menu');
  });

  it('Escape closes the drawer and returns focus to the toggle', () => {
    renderLayout();
    const toggle = screen.getByRole('button', { name: 'Open menu' }) as HTMLButtonElement;
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(region).toHaveAttribute('hidden');
    expect(document.activeElement).toBe(toggle);
  });

  it('resizing across the lg breakpoint closes the drawer so state cannot go stale', () => {
    renderLayout();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    fireEvent(window, new Event('resize'));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(region).toHaveAttribute('hidden');
  });
});

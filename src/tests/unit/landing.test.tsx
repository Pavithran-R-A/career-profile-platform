import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Home from '../../pages/Home';
import { ensureTemplatesRegistered } from '../../lib/templates/registry';

ensureTemplatesRegistered();

vi.mock('../../lib/auth/context', () => ({
  useAuth: () => ({ status: 'unauthenticated', user: null }),
}));

describe('Landing page', () => {
  it('uses truthful positioning, not unverifiable verification claims', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/recruiters remember/i);
    expect(screen.queryByText(/verified|verification/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GitHub evidence/i)).not.toBeInTheDocument();
  });

  it('demonstrates the product flow and renders a real portfolio example', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getAllByText('Your CV').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Career profile').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ATS resume').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Portfolio').length).toBeGreaterThan(0);
    // real rendered template output from the demo fixture
    expect(screen.getAllByText('Amara Okafor').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Northwind Data/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Flowdeck/).length).toBeGreaterThan(0);
  });

  it('has CTAs for importing a CV and seeing a live profile', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    const primary = screen.getAllByRole('link', { name: /Import your CV/i });
    expect(primary.length).toBeGreaterThan(0);
    expect(primary[0]).toHaveAttribute('href', '/signup');
    expect(screen.getAllByRole('link', { name: /See a live profile/i })[0]).toHaveAttribute(
      'href',
      '/#templates'
    );
  });
});

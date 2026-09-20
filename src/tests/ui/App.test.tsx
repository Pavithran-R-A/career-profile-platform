import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

describe('App shell', () => {
  it('renders the home page with heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your career, verified.');
  });

  it('renders the header with brand link', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/');
  });

  it('renders footer', () => {
    render(<App />);
    expect(screen.getByText(/Career Profile Platform/)).toBeInTheDocument();
  });
});

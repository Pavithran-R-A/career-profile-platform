import { useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { BrandLink } from './Brand';

const AUTH_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/dashboard/profile', label: 'Profile' },
  { to: '/dashboard/resume', label: 'Resume' },
  { to: '/dashboard/preview', label: 'Portfolio' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link nav-link-active' : 'nav-link';
}

export default function Layout() {
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthed = auth.status === 'authenticated';

  const handleSignOut = () => {
    setMenuOpen(false);
    void auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLink />

          <nav className="hidden md:flex items-center gap-6" aria-label="Primary">
            {isAuthed ? (
              <>
                {AUTH_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={navClass}
                    end={item.to === '/dashboard'}>
                    {item.label}
                  </NavLink>
                ))}
                <button onClick={handleSignOut} className="nav-link px-1">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/#how-it-works" className="nav-link">
                  How it works
                </Link>
                <Link to="/login" className="nav-link">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm bg-[var(--ink)] text-white px-4 py-2 rounded-full hover:bg-[#1d2939] font-medium">
                  Get started
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-gray-700 hover:bg-gray-100"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}>
            <svg
              aria-hidden="true"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav
            className="md:hidden border-t border-[var(--border)] bg-white px-4 py-3 space-y-1"
            aria-label="Mobile">
            {isAuthed ? (
              <>
                {AUTH_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block px-3 py-3 rounded-md text-base min-h-[44px] ${isActive ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`
                    }>
                    {item.label}
                  </NavLink>
                ))}
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-3 py-3 rounded-md text-base text-gray-700 hover:bg-gray-50 min-h-[44px]">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/#how-it-works"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base text-gray-700 hover:bg-gray-50 min-h-[44px]">
                  How it works
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base text-gray-700 hover:bg-gray-50 min-h-[44px]">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base font-semibold bg-[var(--ink)] text-white text-center min-h-[44px]">
                  Get started
                </Link>
              </>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border)] bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--faint-foreground)]">
          <p>
            &copy; {new Date().getFullYear()} Career Profile — one profile, built for recruiters.
          </p>
          {!isAuthed && (
            <nav className="flex items-center gap-5" aria-label="Footer">
              <Link to="/#how-it-works" className="link-quiet">
                How it works
              </Link>
              <Link to="/#example" className="link-quiet">
                Example
              </Link>
              <Link to="/pricing" className="link-quiet">
                Pricing
              </Link>
            </nav>
          )}
        </div>
      </footer>
    </div>
  );
}

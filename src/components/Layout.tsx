import { useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router';
import { useAuth } from '../lib/auth/context';

const AUTH_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/dashboard/profile', label: 'Profile' },
  { to: '/dashboard/resume', label: 'Resume' },
  { to: '/dashboard/preview', label: 'Portfolio' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm px-1 py-2 ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900'}`;
}

export default function Layout() {
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = () => {
    setMenuOpen(false);
    void auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 shrink-0"
            aria-label="Career Profile home">
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
              C
            </span>
            <span className="text-base font-semibold tracking-tight text-gray-900">
              Career Profile
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-5" aria-label="Primary">
            {auth.status === 'authenticated' ? (
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
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 hover:text-gray-900 px-1 py-2">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/pricing" className="text-sm text-gray-600 hover:text-gray-900 px-1 py-2">
                  Pricing
                </Link>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 px-1 py-2">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 font-medium">
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
            className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-1"
            aria-label="Mobile">
            {auth.status === 'authenticated' ? (
              <>
                {AUTH_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block px-3 py-3 rounded-md text-base ${isActive ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`
                    }>
                    {item.label}
                  </NavLink>
                ))}
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-3 py-3 rounded-md text-base text-gray-700 hover:bg-gray-50">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/pricing"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base text-gray-700 hover:bg-gray-50">
                  Pricing
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base text-gray-700 hover:bg-gray-50">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base font-semibold bg-gray-900 text-white text-center">
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
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} Career Profile Platform</p>
          <nav className="flex items-center gap-4" aria-label="Footer">
            <Link to="/pricing" className="hover:text-gray-900">
              Pricing
            </Link>
            <Link to="/dashboard/billing" className="hover:text-gray-900">
              Billing
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

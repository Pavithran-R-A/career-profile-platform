import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { BrandLink, BrandMark } from './Brand';

const AUTH_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/dashboard/profile', label: 'Profile' },
  { to: '/dashboard/resume', label: 'Resume' },
  { to: '/dashboard/preview', label: 'Portfolio' },
];

const GUEST_NAV = [
  { href: '/#features', label: 'Features' },
  { href: '/#templates', label: 'Templates' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#for-recruiters', label: 'For recruiters' },
  { href: '/pricing', label: 'Pricing' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link nav-link-active' : 'nav-link';
}

function AccountMenu({ onSignOut, initial }: { onSignOut: () => void; initial: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-10 pl-1.5 pr-2.5 rounded-full border border-[var(--border)] bg-white hover:bg-[var(--surface-muted)] transition-colors">
        <span
          aria-hidden="true"
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'var(--ink)' }}>
          {initial}
        </span>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="var(--muted-foreground)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-12 w-56 rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-pop)] py-2 z-50">
          <div className="px-4 py-2 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--ink)]">Your account</p>
            <p className="text-xs text-[var(--faint-foreground)] mt-0.5">
              Manage your career profile
            </p>
          </div>
          <Link
            to="/dashboard/appearance"
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-muted)]">
            Appearance
          </Link>
          <Link
            to="/pricing"
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-muted)]">
            Pricing
          </Link>
          <Link
            to="/dashboard/account/delete"
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]">
            Delete account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="block w-full text-left px-4 py-2.5 text-sm text-[var(--danger)] hover:bg-[var(--danger-surface)] border-t border-[var(--border)] mt-1">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isAuthed = auth.status === 'authenticated';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = () => {
    setMenuOpen(false);
    void auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-2 focus:left-2 focus:bg-[var(--ink)] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm">
        Skip to content
      </a>
      <header
        className={`sticky top-0 z-50 transition-shadow duration-200 border-b ${
          scrolled
            ? 'border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm shadow-[0_1px_0_rgb(11_22_40_/_0.04),0_8px_24px_-16px_rgb(11_22_40_/_0.25)]'
            : 'border-transparent bg-[var(--surface)]'
        }`}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLink />

          <nav className="hidden lg:flex items-center gap-6" aria-label="Primary">
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
                <AccountMenu
                  onSignOut={handleSignOut}
                  initial={((auth.status === 'authenticated' && auth.user.email) ||
                    'a')[0].toUpperCase()}
                />
              </>
            ) : (
              <>
                {GUEST_NAV.map((item) => (
                  <Link key={item.href} to={item.href} className="nav-link">
                    {item.label}
                  </Link>
                ))}
                <span className="w-px h-4 bg-[var(--border-strong)]" aria-hidden="true" />
                <Link to="/login" className="nav-link">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm bg-[var(--accent)] text-white px-4 py-2 rounded-full hover:bg-[var(--accent-strong)] font-medium transition-colors">
                  Get started
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
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
            className="lg:hidden border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 space-y-1"
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
                      `block px-3 py-3 rounded-md text-base min-h-[44px] ${isActive ? 'bg-[var(--surface-muted)] text-[var(--ink)] font-semibold' : 'text-[var(--foreground)] hover:bg-[var(--surface-muted)]'}`
                    }>
                    {item.label}
                  </NavLink>
                ))}
                <Link
                  to="/dashboard/appearance"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base text-[var(--foreground)] hover:bg-[var(--surface-muted)] min-h-[44px]">
                  Appearance
                </Link>
                <Link
                  to="/dashboard/account/delete"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] min-h-[44px]">
                  Delete account
                </Link>
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-3 py-3 rounded-md text-base text-[var(--danger)] hover:bg-[var(--danger-surface)] min-h-[44px]">
                  Sign out
                </button>
              </>
            ) : (
              <>
                {GUEST_NAV.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-3 rounded-md text-base text-[var(--foreground)] hover:bg-[var(--surface-muted)] min-h-[44px]">
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base text-[var(--foreground)] hover:bg-[var(--surface-muted)] min-h-[44px]">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base font-semibold bg-[var(--accent)] text-white text-center min-h-[44px]">
                  Get started
                </Link>
              </>
            )}
          </nav>
        )}
      </header>
      {/* tabIndex={-1} makes the landmark programmatically focusable so the
          skip link actually moves focus (QA-021); no ring for pointer users. */}
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--faint-foreground)]">
          <p className="flex items-center gap-2">
            <BrandMark size={16} />
            &copy; {new Date().getFullYear()} Career Profile — one profile, built for recruiters.
          </p>
          {!isAuthed && (
            <nav className="flex items-center gap-5" aria-label="Footer">
              <Link to="/#features" className="link-quiet">
                Features
              </Link>
              <Link to="/#templates" className="link-quiet">
                Templates
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

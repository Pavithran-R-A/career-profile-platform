import { Outlet, Link } from 'react-router';
import { useAuth } from '../lib/auth/context';

export default function Layout() {
  const auth = useAuth();

  const handleSignOut = () => {
    void auth.signOut();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Profile
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
              Pricing
            </Link>
            {auth.status === 'authenticated' ? (
              <>
                <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link to="/dashboard/billing" className="text-sm text-gray-600 hover:text-gray-900">
                  Billing
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 hover:text-gray-900">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 py-8 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} Career Profile Platform
      </footer>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-lg font-semibold tracking-tight">
            Profile
          </a>
          <nav className="text-sm text-[var(--muted-foreground)]">Stage 0</nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-[var(--muted-foreground)]">
        &copy; {new Date().getFullYear()} Career Profile Platform
      </footer>
    </div>
  );
}

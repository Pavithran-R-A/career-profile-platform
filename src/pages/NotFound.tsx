export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <p className="mt-4 text-lg text-gray-600">This page does not exist.</p>
      <a
        href="/"
        className="mt-6 inline-block text-sm underline underline-offset-4 hover:text-[var(--foreground)]">
        Go home
      </a>
    </div>
  );
}

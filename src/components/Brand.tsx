import { Link } from 'react-router';

/**
 * CareerProfile Go identity: one professional profile that can move upward
 * into every career output. The mark combines a career-profile silhouette,
 * an open C, and a forward/upward arrow, and remains readable at favicon size.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0"
      style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#0B1628" />
        <path
          d="M23.1 8.2A9.6 9.6 0 1 0 23.2 23.8"
          stroke="#246BFD"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="13.25" cy="12.6" r="2.25" fill="#F8FAFC" />
        <path
          d="M8.9 20.25c.9-2.95 2.45-4.4 4.35-4.4s3.45 1.45 4.35 4.4"
          stroke="#F8FAFC"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M17.7 20.7 26 12.4M21.35 12.4H26v4.65"
          stroke="#13B88A"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function BrandWordmark({ light = false }: { light?: boolean }) {
  const base = light ? '#ffffff' : 'var(--ink)';
  return (
    <span
      className="text-[15px] font-bold tracking-[-0.03em]"
      style={{ color: base }}>
      <span>CareerProfile</span>
      <span style={{ color: light ? '#ffffff' : 'var(--accent)' }}>Go</span>
    </span>
  );
}

export function BrandLink({ to = '/', light = false }: { to?: string; light?: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 shrink-0"
      aria-label="CareerProfile Go home">
      <BrandMark />
      <BrandWordmark light={light} />
    </Link>
  );
}

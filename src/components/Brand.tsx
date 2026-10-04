import { Link } from 'react-router';

/**
 * CVentory identity: a career document + rising signal bars.
 * Designed to remain recognizable at favicon size.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#0B1628" />
        <path d="M6.5 6.25h9.2l4.3 4.3V24H6.5V6.25Z" fill="#F8FAFC" />
        <path d="M15.7 6.25v4.3H20l-4.3-4.3Z" fill="#246BFD" />
        <circle cx="11.25" cy="12.25" r="1.7" fill="#0B1628" />
        <path d="M8.65 17.2c.4-1.65 1.35-2.45 2.6-2.45 1.26 0 2.2.8 2.61 2.45H8.65Z" fill="#0B1628" />
        <rect x="8.6" y="19.1" width="6.3" height="1.35" rx=".675" fill="#728096" />
        <rect x="18.1" y="20.1" width="2.8" height="5.65" rx="1.4" fill="#246BFD" />
        <rect x="21.95" y="16.65" width="2.8" height="9.1" rx="1.4" fill="#0F88FF" />
        <rect x="25.8" y="12.55" width="2.8" height="13.2" rx="1.4" fill="#13B88A" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ light = false }: { light?: boolean }) {
  return (
    <span
      className="text-[15px] font-bold tracking-[-0.025em]"
      style={{ color: light ? '#ffffff' : 'var(--ink)' }}>
      <span style={{ color: light ? '#ffffff' : 'var(--accent)' }}>CV</span>entory
    </span>
  );
}

export function BrandLink({ to = '/', light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 shrink-0" aria-label="CVentory home">
      <BrandMark />
      <BrandWordmark light={light} />
    </Link>
  );
}

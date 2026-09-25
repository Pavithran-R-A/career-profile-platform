import { Link } from 'react-router';

/**
 * Ascending-bars identity: career progress / signal / growth.
 * Navy square, three rising strokes — third stroke carries cobalt,
 * with a subtle teal base tick for a secondary accent.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  const unit = size / 32;
  const radius = size * 0.27;
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-end justify-center rounded-[var(--radius)]"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'var(--navy-surface)',
        padding: size * 0.22,
        gap: size * 0.085,
        boxShadow: '0 1px 2px rgb(11 22 40 / 0.25)',
      }}>
      <span
        style={{
          width: 3 * unit,
          height: size * 0.3,
          borderRadius: unit * 1.5,
          background: 'rgba(255,255,255,0.85)',
        }}
      />
      <span
        style={{
          width: 3 * unit,
          height: size * 0.5,
          borderRadius: unit * 1.5,
          background: 'rgba(255,255,255,0.95)',
        }}
      />
      <span
        style={{
          width: 3 * unit,
          height: size * 0.76,
          borderRadius: unit * 1.5,
          background: 'var(--accent)',
        }}
      />
    </span>
  );
}

export function BrandWordmark({ light = false }: { light?: boolean }) {
  return (
    <span
      className="text-[15px] font-semibold tracking-[-0.02em]"
      style={{ color: light ? '#ffffff' : 'var(--ink)' }}>
      Career Profile
    </span>
  );
}

export function BrandLink({ to = '/', light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 shrink-0" aria-label="Career Profile home">
      <BrandMark />
      <BrandWordmark light={light} />
    </Link>
  );
}

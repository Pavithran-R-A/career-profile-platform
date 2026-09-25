import { Link } from 'react-router';

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-end justify-center gap-[3px] rounded-[9px] bg-[#0b1220] p-[7px]"
      style={{ width: size, height: size }}>
      <span className="w-[3px] rounded-sm bg-white" style={{ height: size * 0.32 }} />
      <span className="w-[3px] rounded-sm bg-white" style={{ height: size * 0.52 }} />
      <span className="w-[3px] rounded-sm bg-[#60a5fa]" style={{ height: size * 0.74 }} />
    </span>
  );
}

export function BrandWordmark() {
  return (
    <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#0b1220]">
      Career Profile
    </span>
  );
}

export function BrandLink({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 shrink-0" aria-label="Career Profile home">
      <BrandMark />
      <BrandWordmark />
    </Link>
  );
}

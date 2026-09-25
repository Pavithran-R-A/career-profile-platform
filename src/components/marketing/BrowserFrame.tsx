import type { ReactNode } from 'react';

/** Mock browser chrome around a real product render. */
export function BrowserFrame({
  url,
  children,
  className = '',
  chromeBg = '#f1f0ec',
}: {
  url: string;
  children: ReactNode;
  className?: string;
  chromeBg?: string;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden border border-[var(--border)] bg-white shadow-[var(--shadow-pop)] ${className}`}>
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)]"
        style={{ background: chromeBg }}>
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
        <span className="ml-3 text-xs text-[var(--faint-foreground)] bg-white border border-[var(--border)] rounded-full px-3 py-0.5 truncate max-w-[60%]">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * Renders a full portfolio template at a reduced scale inside a fixed box.
 * Used across marketing showcase, dashboard thumbnail, and editor preview.
 */
export function ScaledCanvas({
  scale,
  height,
  children,
  label,
}: {
  scale: number;
  height: number;
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      className="relative overflow-hidden bg-white"
      style={{ height }}
      role="img"
      aria-label={label}>
      <div
        aria-hidden="true"
        className="absolute top-0 left-0"
        style={{
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}>
        {children}
      </div>
    </div>
  );
}

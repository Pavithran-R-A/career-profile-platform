import { sanitizeUrl } from '../../lib/validators/url';

export type LinkKind = 'github' | 'linkedin' | 'website';

export function detectLinkKind(label: string, url: string): LinkKind {
  const hay = `${label} ${url}`.toLowerCase();
  if (hay.includes('github')) return 'github';
  if (hay.includes('linkedin')) return 'linkedin';
  return 'website';
}

const PATHS: Record<LinkKind, string> = {
  github:
    'M12 2C6.48 2 2 6.58 2 12.23c0 4.51 2.87 8.34 6.84 9.69.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.92-2.34 4.79-4.57 5.04.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.04 10.04 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z',
  linkedin:
    'M6.94 8.5H3.56V19h3.38V8.5ZM5.25 7.04a1.96 1.96 0 1 0 0-3.92 1.96 1.96 0 0 0 0 3.92ZM19.44 19h-3.37v-5.12c0-1.22-.02-2.79-1.7-2.79-1.7 0-1.96 1.33-1.96 2.7V19H9.04V8.5h3.23v1.44h.05c.45-.85 1.55-1.75 3.19-1.75 3.41 0 4.04 2.25 4.04 5.17V19h-.11Z',
  website:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5 0 4.5-4 4.5-9S14.5 3 12 3 7.5 7 7.5 12s2 9 4.5 9Zm9-9H3',
};

export function LinkIcon({
  label,
  url,
  className = '',
  size = 16,
}: {
  label: string;
  url: string;
  className?: string;
  size?: number;
}) {
  const kind = detectLinkKind(label, url);
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={kind === 'github' || kind === 'linkedin' ? 'currentColor' : 'none'}
      stroke={kind === 'github' || kind === 'linkedin' ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}>
      <path
        d={PATHS[kind]}
        fill={kind === 'github' || kind === 'linkedin' ? 'currentColor' : undefined}
      />
    </svg>
  );
}

export function ExternalLink({
  label,
  url,
  children,
  className = '',
  withIcon = true,
}: {
  label: string;
  url: string;
  children?: React.ReactNode;
  className?: string;
  withIcon?: boolean;
}) {
  return (
    <a href={sanitizeUrl(url)} target="_blank" rel="noopener noreferrer" className={className}>
      {withIcon && <LinkIcon label={label} url={url} className="inline-block mr-1.5 -mt-0.5" />}
      {children ?? label}
    </a>
  );
}

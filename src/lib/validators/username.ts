const RESERVED_USERNAMES = new Set([
  'www',
  'api',
  'app',
  'admin',
  'administrator',
  'root',
  'support',
  'help',
  'mail',
  'email',
  'smtp',
  'ftp',
  'cdn',
  'static',
  'assets',
  'status',
  'billing',
  'payments',
  'auth',
  'login',
  'logout',
  'signup',
  'register',
  'dashboard',
  'settings',
  'account',
  'accounts',
  'profile',
  'profiles',
  'domain',
  'domains',
  'docs',
  'blog',
  'careers',
  'jobs',
  'security',
  'legal',
  'privacy',
  'terms',
  'null',
  'undefined',
  'localhost',
  'webmaster',
  'abuse',
  'hostmaster',
  'postmaster',
  'nobody',
  'daemon',
  'localhost',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'dev',
  'staging',
  'test',
  'production',
  'portal',
  'system',
  'config',
  'health',
  'status',
  'metrics',
  'monitoring',
  'logs',
  'trace',
]);

const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const MIN_LENGTH = 2;
const MAX_LENGTH = 63;

export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}

export function validateUsername(raw: string): {
  valid: boolean;
  username: string;
  error: string | null;
} {
  const username = normalizeUsername(raw);
  if (username.length < MIN_LENGTH)
    return { valid: false, username, error: `Username must be at least ${MIN_LENGTH} characters` };
  if (username.length > MAX_LENGTH)
    return { valid: false, username, error: `Username must be at most ${MAX_LENGTH} characters` };
  if (!USERNAME_REGEX.test(username))
    return {
      valid: false,
      username,
      error:
        'Username must contain only lowercase letters, digits, and hyphens (cannot start or end with hyphen)',
    };
  if (isReservedUsername(username))
    return { valid: false, username, error: `"${username}" is a reserved username` };
  return { valid: true, username, error: null };
}

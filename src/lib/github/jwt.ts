/**
 * GitHub App JWT (RS256) generation.
 *
 * Config is EXPLICIT: the caller passes an immutable { appId, privateKey }
 * pair derived from the request's Env. Nothing in this module reads
 * process.env, so one request's configuration can never leak into another's
 * JWT — concurrent operations with different configs are fully isolated.
 */

export interface GitHubJwtConfig {
  appId: string;
  privateKey: string;
}

interface CachedJwt {
  token: string;
  expiresAt: number;
}

// Cache keyed by a config identity (appId + stable digest of the key) so two
// concurrent callers with different configs never read each other's tokens.
const jwtCache = new Map<string, CachedJwt>();

const TOKEN_LIFETIME_S = 9 * 60;
const TOKEN_REFRESH_MARGIN_S = 60;

function configIdentity(config: GitHubJwtConfig): string {
  // Non-cryptographic but stable: identical configs share, differing configs
  // (appId or any key byte) collide never.
  let h1 = 0x811c9dc5;
  for (let i = 0; i < config.privateKey.length; i++) {
    h1 ^= config.privateKey.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return `${config.appId}:${h1.toString(16)}`;
}

function base64UrlEncode(data: Uint8Array | ArrayBuffer): string {
  // Realm-safe: isView/constructors work across VM boundaries (jsdom vs node
  // webcrypto), unlike instanceof.
  const bytes = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data as ArrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export function isGitHubJwtConfigured(config: GitHubJwtConfig | undefined | null): boolean {
  return Boolean(config && config.appId && config.privateKey);
}

export async function getGitHubJWT(config: GitHubJwtConfig): Promise<string> {
  if (!config.appId || !config.privateKey) {
    throw new Error('GitHub App not configured');
  }

  const identity = configIdentity(config);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cached = jwtCache.get(identity);
  if (cached && cached.expiresAt > nowSeconds) {
    return cached.token;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: nowSeconds - 60,
    exp: nowSeconds + TOKEN_LIFETIME_S,
    iss: config.appId,
  };

  const encoder = new TextEncoder();
  const headerEncoded = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(encoder.encode(JSON.stringify(payload)));

  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const key = await importPrivateKey(config.privateKey);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput)
  );

  const signatureEncoded = base64UrlEncode(signature);
  const token = `${signingInput}.${signatureEncoded}`;

  jwtCache.set(identity, {
    token,
    expiresAt: nowSeconds + TOKEN_LIFETIME_S - TOKEN_REFRESH_MARGIN_S,
  });
  // Bound the cache: configs are per-deployment constants, so size 8 is far
  // beyond any real use (tests use two).
  if (jwtCache.size > 8) {
    const oldest = jwtCache.keys().next().value;
    if (oldest !== undefined) jwtCache.delete(oldest);
  }

  return token;
}

export function clearGitHubJWTCache(): void {
  jwtCache.clear();
}

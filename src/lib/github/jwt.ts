interface GitHubAppConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  stateSecret: string;
}

let cachedJWT: string | null = null;
let jwtExpiresAt = 0;

function getAppConfig(): GitHubAppConfig {
  return {
    appId: process.env.GITHUB_APP_ID || '',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    privateKey: (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    stateSecret: process.env.GITHUB_STATE_SECRET || '',
  };
}

function base64UrlEncode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
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

export async function getGitHubJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedJWT && jwtExpiresAt > now) {
    return cachedJWT;
  }

  const config = getAppConfig();

  if (!config.appId || !config.privateKey) {
    throw new Error('GitHub App not configured');
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iat: nowSeconds - 60,
    exp: nowSeconds + 9 * 60,
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
    encoder.encode(signingInput).buffer
  );

  const signatureEncoded = base64UrlEncode(signature);

  cachedJWT = `${signingInput}.${signatureEncoded}`;
  jwtExpiresAt = nowSeconds + 9 * 60 - 60;

  return cachedJWT;
}

export function getAppId(): string {
  return getAppConfig().appId;
}

export function getClientId(): string {
  return getAppConfig().clientId;
}

export function getClientSecret(): string {
  return getAppConfig().clientSecret;
}

export function getStateSecret(): string {
  return getAppConfig().stateSecret;
}

export function isGitHubConfigured(): boolean {
  const config = getAppConfig();
  return Boolean(config.appId && config.privateKey);
}

export function clearGitHubJWTCache(): void {
  cachedJWT = null;
  jwtExpiresAt = 0;
}

export { getGitHubJWT as createGitHubJWT };

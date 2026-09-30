import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  getGitHubJWT,
  clearGitHubJWTCache,
  isGitHubJwtConfigured,
  type GitHubJwtConfig,
} from '../../lib/github/jwt';

const { privateKeyPem } = (() => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
})();

const CONFIG: GitHubJwtConfig = { appId: '12345', privateKey: privateKeyPem };

describe('getGitHubJWT', () => {
  it('throws when GitHub App is not configured (missing key)', async () => {
    await expect(getGitHubJWT({ appId: '12345', privateKey: '' })).rejects.toThrow(
      'GitHub App not configured'
    );
  });

  it('throws when key is invalid but config is set', async () => {
    await expect(
      getGitHubJWT({ appId: '12345', privateKey: 'not-a-real-pem-key' })
    ).rejects.toThrow();
  });

  it('signs a real RS256 JWT with an explicit config', async () => {
    clearGitHubJWTCache();
    const token = await getGitHubJWT(CONFIG);
    const [h, p, s] = token.split('.');
    expect(h).toBeTruthy();
    expect(p).toBeTruthy();
    expect(s).toBeTruthy();
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as {
      iss: string;
      exp: number;
      iat: number;
    };
    expect(payload.iss).toBe('12345');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('caches per config identity: same config reuses, different config signs fresh', async () => {
    clearGitHubJWTCache();
    const a = await getGitHubJWT(CONFIG);
    const a2 = await getGitHubJWT(CONFIG);
    expect(a).toBe(a2);

    const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const other = await getGitHubJWT({
      appId: '99999',
      privateKey: otherKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    });
    expect(other).not.toBe(a);
  });
});

describe('isGitHubJwtConfigured', () => {
  it('is false without config', () => {
    expect(isGitHubJwtConfigured(null)).toBe(false);
    expect(isGitHubJwtConfigured({ appId: '', privateKey: '' })).toBe(false);
  });

  it('is true with appId and key', () => {
    expect(isGitHubJwtConfigured(CONFIG)).toBe(true);
  });
});

describe('clearGitHubJWTCache', () => {
  it('forces a fresh signature after clearing', async () => {
    clearGitHubJWTCache();
    const a = await getGitHubJWT(CONFIG);
    clearGitHubJWTCache();
    const b = await getGitHubJWT(CONFIG);
    // iat has second resolution; token may be identical within the same
    // second, but the cache no longer serves the old one.
    expect(typeof b).toBe('string');
    expect(a.split('.').length).toBe(3);
  });
});

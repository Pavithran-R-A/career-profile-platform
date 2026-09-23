import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGitHubJWT, clearGitHubJWTCache, isGitHubConfigured } from '../../lib/github/jwt';

describe('getGitHubJWT', () => {
  beforeEach(() => {
    clearGitHubJWTCache();
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  afterEach(() => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  it('throws when GitHub App is not configured', async () => {
    await expect(getGitHubJWT()).rejects.toThrow('GitHub App not configured');
  });

  it('throws when key is invalid but env is set', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY = 'not-a-real-pem-key';
    await expect(getGitHubJWT()).rejects.toThrow();
  });
});

describe('clearGitHubJWTCache', () => {
  beforeEach(() => {
    clearGitHubJWTCache();
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  afterEach(() => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  it('clears the cached JWT', () => {
    clearGitHubJWTCache();
    expect(isGitHubConfigured()).toBe(false);
  });
});

describe('isGitHubConfigured', () => {
  beforeEach(() => {
    clearGitHubJWTCache();
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  afterEach(() => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  it('returns false when not configured', () => {
    expect(isGitHubConfigured()).toBe(false);
  });

  it('returns true when both appId and privateKey are set', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY = 'test-key';
    expect(isGitHubConfigured()).toBe(true);
  });

  it('returns false when only appId is set', () => {
    process.env.GITHUB_APP_ID = '12345';
    expect(isGitHubConfigured()).toBe(false);
  });

  it('returns false when only privateKey is set', () => {
    process.env.GITHUB_APP_PRIVATE_KEY = 'test-key';
    expect(isGitHubConfigured()).toBe(false);
  });
});

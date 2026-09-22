import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGitHubJWT, clearGitHubJWTCache, isGitHubConfigured } from '../../lib/github/jwt';

describe('getGitHubJWT', () => {
  beforeEach(() => {
    clearGitHubJWTCache();
  });

  afterEach(() => {
    clearGitHubJWTCache();
  });

  it('throws when GitHub App is not configured', async () => {
    await expect(getGitHubJWT()).rejects.toThrow('GitHub App not configured');
  });

  it('returns a string token', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY = 'test-key';

    try {
      await expect(getGitHubJWT()).rejects.toThrow();
    } finally {
      delete process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_APP_PRIVATE_KEY;
    }
  });

  it('caches the token', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY = 'test-key';

    try {
      await expect(getGitHubJWT()).rejects.toThrow();
    } finally {
      delete process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_APP_PRIVATE_KEY;
    }
  });
});

describe('clearGitHubJWTCache', () => {
  it('clears the cached JWT', () => {
    clearGitHubJWTCache();
    expect(isGitHubConfigured()).toBe(false);
  });
});

describe('isGitHubConfigured', () => {
  it('returns false when not configured', () => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    expect(isGitHubConfigured()).toBe(false);
  });

  it('returns true when configured', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY = 'test-key';

    try {
      expect(isGitHubConfigured()).toBe(true);
    } finally {
      delete process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_APP_PRIVATE_KEY;
    }
  });

  it('returns false when only appId is set', () => {
    process.env.GITHUB_APP_ID = '12345';
    delete process.env.GITHUB_APP_PRIVATE_KEY;

    try {
      expect(isGitHubConfigured()).toBe(false);
    } finally {
      delete process.env.GITHUB_APP_ID;
    }
  });
});

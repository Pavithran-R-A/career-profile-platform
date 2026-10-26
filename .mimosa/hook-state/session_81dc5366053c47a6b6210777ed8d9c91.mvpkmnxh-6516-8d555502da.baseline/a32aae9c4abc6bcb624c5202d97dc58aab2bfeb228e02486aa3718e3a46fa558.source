// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveGitHubConfig, isGitHubAppConfigured } from '../../lib/github/config';
import {
  createSignedState,
  verifySignedState,
  createSelectionToken,
  verifySelectionToken,
  githubInstallInfo,
} from '../../lib/github/server';
import type { GitHubEnvSource } from '../../lib/github/config';

// All six Flow-A values present. The exact variables the production flow
// requires: appId, private key, client id, client secret, state secret, slug.
const FULL_ENV: GitHubEnvSource = {
  GITHUB_APP_ID: '12345',
  GITHUB_APP_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
  GITHUB_APP_CLIENT_ID: 'Iv1.testclientid',
  GITHUB_APP_CLIENT_SECRET: 'test-client-secret',
  GITHUB_STATE_SECRET: 'independent-state-secret',
  GITHUB_APP_SLUG: 'career-profile-app-test',
};

describe('isGitHubAppConfigured requires ALL six Flow-A variables', () => {
  it('accepts a complete configuration', () => {
    expect(isGitHubAppConfigured(resolveGitHubConfig(FULL_ENV))).toBe(true);
  });

  it('missing app id -> false', () => {
    const env = { ...FULL_ENV, GITHUB_APP_ID: '' };
    expect(isGitHubAppConfigured(resolveGitHubConfig(env))).toBe(false);
  });

  it('zero app id -> false', () => {
    const env = { ...FULL_ENV, GITHUB_APP_ID: '0' };
    expect(isGitHubAppConfigured(resolveGitHubConfig(env))).toBe(false);
  });

  it('missing private key -> false', () => {
    const env = { ...FULL_ENV, GITHUB_APP_PRIVATE_KEY: '' };
    expect(isGitHubAppConfigured(resolveGitHubConfig(env))).toBe(false);
  });

  it('missing client id -> false', () => {
    const env = { ...FULL_ENV, GITHUB_APP_CLIENT_ID: '' };
    expect(isGitHubAppConfigured(resolveGitHubConfig(env))).toBe(false);
  });

  it('missing client secret -> false', () => {
    const env = { ...FULL_ENV, GITHUB_APP_CLIENT_SECRET: '' };
    expect(isGitHubAppConfigured(resolveGitHubConfig(env))).toBe(false);
  });

  it('missing state secret -> false', () => {
    const env = { ...FULL_ENV, GITHUB_STATE_SECRET: '' };
    expect(isGitHubAppConfigured(resolveGitHubConfig(env))).toBe(false);
  });

  it('missing slug -> false', () => {
    const env = { ...FULL_ENV, GITHUB_APP_SLUG: '' };
    expect(isGitHubAppConfigured(resolveGitHubConfig(env))).toBe(false);
  });
});

describe('signed state has no fallback secret and refuses partial config', () => {
  it('GITHUB_STATE_SECRET is an independent secret (not derived from client secret)', () => {
    // Same clientId/clientSecret but a DIFFERENT state secret must produce a
    // DIFFERENT signature — the state key is never derived from the OAuth
    // client secret (no `gh-state::` fallback).
    const a = createSignedState('user-1', resolveGitHubConfig(FULL_ENV));
    const b = createSignedState(
      'user-1',
      resolveGitHubConfig({ ...FULL_ENV, GITHUB_STATE_SECRET: 'another-independent-secret' })
    );
    expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
    // Each still verifies under its own explicit secret.
    expect(verifySignedState(a, resolveGitHubConfig(FULL_ENV), 'user-1').ok).toBe(true);
    expect(
      verifySignedState(
        a,
        resolveGitHubConfig({ ...FULL_ENV, GITHUB_STATE_SECRET: 'x2' }),
        'user-1'
      ).ok
    ).toBe(false);
  });

  it('rotating the client secret does NOT invalidate states (independent secrets)', () => {
    const state = createSignedState('user-1', resolveGitHubConfig(FULL_ENV));
    const rotated = resolveGitHubConfig({ ...FULL_ENV, GITHUB_APP_CLIENT_SECRET: 'rotated' });
    expect(verifySignedState(state, rotated, 'user-1').ok).toBe(true);
  });

  it('createSignedState throws when the configuration is partial (any missing var)', () => {
    const partials: Array<[string, GitHubEnvSource]> = [
      ['app id', { ...FULL_ENV, GITHUB_APP_ID: '' }],
      ['private key', { ...FULL_ENV, GITHUB_APP_PRIVATE_KEY: '' }],
      ['client id', { ...FULL_ENV, GITHUB_APP_CLIENT_ID: '' }],
      ['client secret', { ...FULL_ENV, GITHUB_APP_CLIENT_SECRET: '' }],
      ['state secret', { ...FULL_ENV, GITHUB_STATE_SECRET: '' }],
      ['slug', { ...FULL_ENV, GITHUB_APP_SLUG: '' }],
    ];
    for (const [name, env] of partials) {
      expect(() => createSignedState('user-1', resolveGitHubConfig(env)), name).toThrow(
        'GITHUB_NOT_CONFIGURED'
      );
    }
  });

  it('selection tokens use the explicit state secret only (no fallback)', () => {
    const config = resolveGitHubConfig(FULL_ENV);
    const token = createSelectionToken(42, 'user-1', config);
    expect(verifySelectionToken(token, config, 'user-1').ok).toBe(true);
    const rotated = resolveGitHubConfig({ ...FULL_ENV, GITHUB_STATE_SECRET: 's2' });
    expect(verifySelectionToken(token, rotated, 'user-1').ok).toBe(false);
  });
});

describe('install info: partial config never exposes an Install entry point', () => {
  it('configured=false and installUrl=null when any of the six is missing', () => {
    const partials: GitHubEnvSource[] = [
      { ...FULL_ENV, GITHUB_APP_ID: '' },
      { ...FULL_ENV, GITHUB_APP_PRIVATE_KEY: '' },
      { ...FULL_ENV, GITHUB_APP_CLIENT_ID: '' },
      { ...FULL_ENV, GITHUB_APP_CLIENT_SECRET: '' },
      { ...FULL_ENV, GITHUB_STATE_SECRET: '' },
      { ...FULL_ENV, GITHUB_APP_SLUG: '' },
    ];
    for (const env of partials) {
      const info = githubInstallInfo(resolveGitHubConfig(env));
      expect(info.configured).toBe(false);
      expect(info.installUrl).toBeNull();
    }
  });

  it('configured=true only for the complete configuration', () => {
    const info = githubInstallInfo(resolveGitHubConfig(FULL_ENV));
    expect(info.configured).toBe(true);
    expect(info.installUrl).toBe(
      'https://github.com/apps/career-profile-app-test/installations/new'
    );
  });
});

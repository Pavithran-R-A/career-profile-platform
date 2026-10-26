// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

vi.mock('./installation', () => ({
  createInstallationToken: vi.fn(async () => ({
    token: 'ghs_test',
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    permissions: {},
    repositories: [],
  })),
  clearInstallationTokenCache: vi.fn(),
}));

// A REAL RSA key so RSASSA-PKCS1-v1_5 signing succeeds in tests.
const { privateKeyPem } = (() => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
})();

import { resolveGitHubConfig } from '../../lib/github/config';
import {
  createSignedState,
  verifySignedState,
  githubInstallInfo,
  verifyInstallationForAccount,
  resolveInstallationForUser,
  createSelectionToken,
  verifySelectionToken,
  listInstallationsForUserToken,
} from '../../lib/github/server';
import type { GitHubModuleConfig } from '../../lib/github/config';

const ENV = {
  GITHUB_STATE_SECRET: 'test-state-secret',
  GITHUB_APP_ID: '12345',
  GITHUB_APP_PRIVATE_KEY: privateKeyPem,
  GITHUB_APP_SLUG: 'career-profile-app-test',
  GITHUB_APP_CLIENT_ID: 'Iv1.testclientid',
  GITHUB_APP_CLIENT_SECRET: 'test-client-secret',
};

function makeConfig(env: Partial<typeof ENV> & { GITHUB_APP_ID?: string }): GitHubModuleConfig {
  return resolveGitHubConfig(env as Record<string, string>);
}

const CONFIG = makeConfig(ENV);

describe('signed install state', () => {
  it('round-trips a state for the same user', () => {
    const state = createSignedState('user-1', CONFIG);
    const result = verifySignedState(state, CONFIG, 'user-1');
    expect(result.ok).toBe(true);
    expect(result.payload?.u).toBe('user-1');
  });

  it('rejects another user replaying the state', () => {
    const state = createSignedState('user-1', CONFIG);
    expect(verifySignedState(state, CONFIG, 'user-2').ok).toBe(false);
    expect(verifySignedState(state, CONFIG, 'user-2').reason).toBe('user_mismatch');
  });

  it('rejects tampered payloads', () => {
    const state = createSignedState('user-1', CONFIG);
    const [body] = state.split('.');
    const forged = `${body}x.${state.split('.')[1]}`;
    const result = verifySignedState(forged, CONFIG, 'user-1');
    expect(result.ok).toBe(false);
  });

  it('rejects states signed with a DIFFERENT config (cross-request isolation)', () => {
    const state = createSignedState('user-1', CONFIG);
    const otherConfig = makeConfig({ ...ENV, GITHUB_STATE_SECRET: 'another-secret' });
    const result = verifySignedState(state, otherConfig, 'user-1');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('rejects expired states', () => {
    const state = createSignedState('user-1', CONFIG);
    const [body, sig] = state.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      u: string;
      n: string;
      t: number;
      e: number;
    };
    const expired = Buffer.from(JSON.stringify({ ...payload, e: payload.t - 1 }), 'utf8').toString(
      'base64url'
    );
    expect(verifySignedState(`${expired}.${sig}`, CONFIG, 'user-1').ok).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(verifySignedState('', CONFIG, 'user-1').ok).toBe(false);
    expect(verifySignedState('no-separator', CONFIG, 'user-1').ok).toBe(false);
  });
});

describe('install info (public-safe)', () => {
  it('builds the install URL from the configured slug', () => {
    const info = githubInstallInfo(CONFIG);
    expect(info.configured).toBe(true);
    expect(info.installUrl).toBe(
      'https://github.com/apps/career-profile-app-test/installations/new'
    );
  });

  it('reports not-configured without leaking partial config', () => {
    const info = githubInstallInfo(makeConfig({ GITHUB_APP_SLUG: 'slug-only' }));
    expect(info.configured).toBe(false);
    expect(info.installUrl).toBeNull();
    expect(info.slug).toBe('slug-only');
  });
});

describe('installation verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts an installation owned by the authorized account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: 42,
              account: { login: 'octocat', id: 7, type: 'User' },
            }),
            { status: 200 }
          )
      )
    );
    const result = await verifyInstallationForAccount(42, 7, CONFIG);
    expect(result).not.toBeNull();
    expect(result?.accountLogin).toBe('octocat');
  });

  it('rejects an installation belonging to a different account (never trust query installation_id)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: 42,
              account: { login: 'someone-else', id: 999, type: 'User' },
            }),
            { status: 200 }
          )
      )
    );
    const result = await verifyInstallationForAccount(42, 7, CONFIG);
    expect(result).toBeNull();
  });

  it('rejects when the App JWT cannot fetch the installation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 404 }))
    );
    const result = await verifyInstallationForAccount(42, 7, CONFIG);
    expect(result).toBeNull();
  });
});

// ─── Flow A: OAuth-during-install resolution (GET /user/installations) ──

describe('resolveInstallationForUser (Flow A)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function stubGitHubFlow(
    installationsBody: unknown,
    appJwtInstallationBody: unknown,
    appJwtStatus = 200
  ) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith('https://github.com/login/oauth/access_token')) {
          return new Response(JSON.stringify({ access_token: 'ghu_test_token' }), { status: 200 });
        }
        if (url.startsWith('https://api.github.com/user/installations')) {
          return new Response(JSON.stringify(installationsBody), { status: 200 });
        }
        if (url.includes('/app/installations/')) {
          return new Response(JSON.stringify(appJwtInstallationBody), { status: appJwtStatus });
        }
        return new Response('unexpected', { status: 404 });
      })
    );
  }

  it('resolves a single eligible installation and cross-verifies with the App JWT', async () => {
    stubGitHubFlow(
      {
        total_count: 1,
        installations: [
          {
            id: 42,
            account: { login: 'octocat', id: 7, type: 'User' },
            app_slug: 'career-profile-app-test',
          },
        ],
      },
      { id: 42, account: { login: 'octocat', id: 7, type: 'User' } }
    );
    const resolution = await resolveInstallationForUser('code-1', CONFIG);
    expect(resolution.status).toBe('single');
    if (resolution.status === 'single') {
      expect(resolution.installation.installationId).toBe(42);
      expect(resolution.installation.accountLogin).toBe('octocat');
    }
  });

  it('returns multiple WITHOUT guessing when several installations are eligible', async () => {
    stubGitHubFlow(
      {
        total_count: 2,
        installations: [
          {
            id: 42,
            account: { login: 'octocat', id: 7, type: 'User' },
            app_slug: 'career-profile-app-test',
          },
          {
            id: 99,
            account: { login: 'org-1', id: 55, type: 'Organization' },
            app_slug: 'career-profile-app-test',
          },
        ],
      },
      { id: 42, account: { login: 'octocat', id: 7, type: 'User' } }
    );
    const resolution = await resolveInstallationForUser('code-1', CONFIG);
    expect(resolution.status).toBe('multiple');
    if (resolution.status === 'multiple') {
      expect(resolution.installations.map((i) => i.installationId).sort()).toEqual([42, 99]);
    }
  });

  it('reports no_eligible when the user has no installation of this app', async () => {
    stubGitHubFlow(
      { total_count: 0, installations: [] },
      { id: 42, account: { login: 'octocat', id: 7, type: 'User' } }
    );
    const resolution = await resolveInstallationForUser('code-1', CONFIG);
    expect(resolution.status).toBe('no_eligible');
  });

  it('filters out installations of OTHER apps by app_slug', async () => {
    stubGitHubFlow(
      {
        total_count: 2,
        installations: [
          {
            id: 42,
            account: { login: 'octocat', id: 7, type: 'User' },
            app_slug: 'career-profile-app-test',
          },
          { id: 77, account: { login: 'other', id: 88, type: 'User' }, app_slug: 'some-other-app' },
        ],
      },
      { id: 42, account: { login: 'octocat', id: 7, type: 'User' } }
    );
    const resolution = await resolveInstallationForUser('code-1', CONFIG);
    expect(resolution.status).toBe('single');
  });

  it('maps a failed code exchange to error/exchange_failed (replayed or invalid code)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 200 })
      )
    );
    const resolution = await resolveInstallationForUser('replayed-code', CONFIG);
    expect(resolution).toEqual({ status: 'error', reason: 'exchange_failed' });
  });

  it('maps a failed installations lookup to error/installations_lookup_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith('https://github.com/login/oauth/access_token')) {
          return new Response(JSON.stringify({ access_token: 'ghu_test_token' }), { status: 200 });
        }
        return new Response('nope', { status: 500 });
      })
    );
    const resolution = await resolveInstallationForUser('code-1', CONFIG);
    expect(resolution).toEqual({ status: 'error', reason: 'installations_lookup_failed' });
  });

  it('maps an App-JWT cross-check failure to error/verify_failed', async () => {
    stubGitHubFlow(
      {
        total_count: 1,
        installations: [
          {
            id: 42,
            account: { login: 'octocat', id: 7, type: 'User' },
            app_slug: 'career-profile-app-test',
          },
        ],
      },
      { message: 'Not Found' },
      404
    );
    const resolution = await resolveInstallationForUser('code-1', CONFIG);
    expect(resolution).toEqual({ status: 'error', reason: 'verify_failed' });
  });

  it('listInstallationsForUserToken tolerates a slugless config (accepts any app)', async () => {
    const slugless = makeConfig({ ...ENV, GITHUB_APP_SLUG: '' });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              installations: [{ id: 42, account: { login: 'octocat', id: 7, type: 'User' } }],
            }),
            { status: 200 }
          )
      )
    );
    const list = await listInstallationsForUserToken('ghu_x', slugless);
    expect(list).toHaveLength(1);
  });
});

// ─── Selection tokens (multiple-installation round-trip) ────────────────

describe('selection tokens', () => {
  it('round-trips the chosen installation for the same user', () => {
    const token = createSelectionToken(99, 'user-1', CONFIG);
    const result = verifySelectionToken(token, CONFIG, 'user-1');
    expect(result.ok).toBe(true);
    expect(result.installationId).toBe(99);
  });

  it('rejects a selection token from another user (User A cannot choose for User B)', () => {
    const token = createSelectionToken(99, 'user-1', CONFIG);
    expect(verifySelectionToken(token, CONFIG, 'user-2').ok).toBe(false);
  });

  it('rejects tokens signed with a different config secret', () => {
    const token = createSelectionToken(99, 'user-1', CONFIG);
    const other = makeConfig({ ...ENV, GITHUB_STATE_SECRET: 'other-secret' });
    expect(verifySelectionToken(token, other, 'user-1').ok).toBe(false);
  });

  it('rejects tampered payloads', () => {
    const token = createSelectionToken(99, 'user-1', CONFIG);
    const [body, sig] = token.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      i: number;
      u: string;
      e: number;
    };
    const forged = Buffer.from(JSON.stringify({ ...payload, i: 12345 }), 'utf8').toString(
      'base64url'
    );
    expect(verifySelectionToken(`${forged}.${sig}`, CONFIG, 'user-1').ok).toBe(false);
  });
});

describe('concurrent operations with different configs (no cross-request bleed)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY = privateKeyPem;
  });

  afterEach(() => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
  });

  it('interleaved state sign/verify with two different configs never cross-verifies', async () => {
    const configA = makeConfig({ ...ENV, GITHUB_STATE_SECRET: 'secret-A' });
    const configB = makeConfig({ ...ENV, GITHUB_STATE_SECRET: 'secret-B' });

    // Fire many operations for both configs concurrently; every state must
    // verify ONLY under the config that created it. verifySignedState is
    // synchronous, so results are wrapped in resolved promises for the
    // interleaved aggregation.
    const tasks = Array.from({ length: 25 }, (_, i) => {
      const user = `user-${i}`;
      return Promise.all([
        Promise.resolve().then(() => createSignedState(user, configA)),
        Promise.resolve().then(() => createSignedState(user, configB)),
      ]).then(([stateA, stateB]) =>
        Promise.all([
          Promise.resolve().then(() => verifySignedState(stateA, configA, user)),
          Promise.resolve().then(() => verifySignedState(stateA, configB, user)),
          Promise.resolve().then(() => verifySignedState(stateB, configB, user)),
          Promise.resolve().then(() => verifySignedState(stateB, configA, user)),
        ])
      );
    });

    const results = await Promise.all(tasks);
    for (const [aInA, aInB, bInB, bInA] of results) {
      expect(aInA.ok).toBe(true);
      expect(aInB.ok).toBe(false);
      expect(bInB.ok).toBe(true);
      expect(bInA.ok).toBe(false);
    }
  });

  it('process.env is never mutated by GitHub operations', () => {
    // The old withGitHubEnv wrote the request env into process.env; explicit
    // config means these stay untouched throughout the whole flow.
    const before = JSON.stringify(process.env.GITHUB_STATE_SECRET ?? null);
    const config = makeConfig({ ...ENV, GITHUB_STATE_SECRET: 'transient-secret' });
    const state = createSignedState('user-1', config);
    const verified = verifySignedState(state, config, 'user-1');
    expect(verified.ok).toBe(true);
    expect(JSON.stringify(process.env.GITHUB_STATE_SECRET ?? null)).toBe(before);
    expect(process.env.GITHUB_STATE_SECRET).toBeUndefined();
  });
});

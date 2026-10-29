// @vitest-environment node
// Independent verification of the P1 sync fix (audit 2026-10-26, review
// 2026-10-27): syncConnectionRepositories must (a) upsert with the REAL
// unique constraint as its conflict target — the previous code upserted
// without options, so the second sync always violated
// github_repositories_connection_id_github_repo_id_key and 502'd — and
// (b) demote repositories no longer returned by the installation so the
// evidence pipeline's stale sweep reaps their evidence.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

vi.mock('../../lib/github/installation', () => ({
  createInstallationToken: vi.fn(async () => ({
    token: 'ghs_test',
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    permissions: {},
    repositories: [],
  })),
  getInstallationToken: vi.fn(async () => ({ token: 'ghs_test' })),
  clearInstallationTokenCache: vi.fn(),
}));

const { privateKeyPem } = (() => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
})();

import { resolveGitHubConfig, type GitHubModuleConfig } from '../../lib/github/config';
import { syncConnectionRepositories } from '../../lib/github/server';
import { FAKE_CLIENT_SECRET } from '../fixtures/fake-values';

const CONFIG: GitHubModuleConfig = resolveGitHubConfig({
  GITHUB_STATE_SECRET: 'test-state-secret',
  GITHUB_APP_ID: '12345',
  GITHUB_APP_PRIVATE_KEY: privateKeyPem,
  GITHUB_APP_SLUG: 'career-profile-app-test',
  GITHUB_APP_CLIENT_ID: 'Iv1.testclientid',
  GITHUB_APP_CLIENT_SECRET: FAKE_CLIENT_SECRET,
});

function githubRepo(id: number, name: string) {
  return {
    id,
    owner: { login: 'octocat' },
    name,
    full_name: `octocat/${name}`,
    description: `${name} description`,
    html_url: `https://github.com/octocat/${name}`,
    private: false,
    fork: false,
    archived: false,
    default_branch: 'main',
    language: 'TypeScript',
    topics: [],
    stargazers_count: 3,
    forks_count: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    pushed_at: '2026-03-01T00:00:00Z',
  };
}

function recordingStore(
  existing: Array<{
    github_repo_id: number;
    selected_for_evidence: boolean;
    show_publicly: boolean;
  }>
) {
  const calls = {
    upserts: [] as Array<{
      rows: Array<Record<string, unknown>>;
      options?: { onConflict?: string };
    }>,
    updates: [] as Array<{ values: Record<string, unknown> }>,
  };
  const supabase = {
    from: (table: string) => {
      expect(table).toBe('github_repositories');
      return {
        select: () => ({
          eq: async () => ({ data: existing, error: null }),
        }),
        upsert: async (rows: unknown, options?: { onConflict?: string }) => {
          calls.upserts.push({ rows: rows as Array<Record<string, unknown>>, options });
          return { error: null };
        },
        update: (values: Record<string, unknown>) => {
          calls.updates.push({ values });
          return {
            eq: () => ({
              in: async () => ({ error: null }),
            }),
          };
        },
      };
    },
  };
  return { supabase, calls };
}

describe('syncConnectionRepositories', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/installation/repositories')) {
          return new Response(
            JSON.stringify({ repositories: [githubRepo(101, 'alpha'), githubRepo(102, 'beta')] }),
            {
              status: 200,
              headers: { 'x-total-count': '2', 'Content-Type': 'application/json' },
            }
          );
        }
        return new Response('unexpected', { status: 404 });
      })
    );
  });

  it('upserts with the real unique constraint as conflict target and preserves owner flags', async () => {
    const { supabase, calls } = recordingStore([
      { github_repo_id: 101, selected_for_evidence: true, show_publicly: true },
    ]);

    const outcome = await syncConnectionRepositories({
      connectionId: 'conn-1',
      installationId: 42,
      config: CONFIG,
      supabase: supabase as never,
    });

    expect(outcome).toEqual({ ok: true, repositoriesSynced: 2, totalAvailable: 2 });
    expect(calls.upserts).toHaveLength(1);
    // THE FIX: without this conflict target the second sync 502'd forever.
    expect(calls.upserts[0].options).toMatchObject({ onConflict: 'connection_id,github_repo_id' });
    const row101 = calls.upserts[0].rows.find((r) => r.github_repo_id === 101);
    const row102 = calls.upserts[0].rows.find((r) => r.github_repo_id === 102);
    // Owner decisions survive the sync…
    expect(row101).toMatchObject({ selected_for_evidence: true, show_publicly: true });
    // …and repos never seen before default to unselected/private.
    expect(row102).toMatchObject({ selected_for_evidence: false, show_publicly: false });
  });

  it('demotes repositories the installation no longer reports (stale-repo reap)', async () => {
    const { supabase, calls } = recordingStore([
      { github_repo_id: 101, selected_for_evidence: true, show_publicly: true },
      { github_repo_id: 999, selected_for_evidence: true, show_publicly: true },
    ]);

    const outcome = await syncConnectionRepositories({
      connectionId: 'conn-1',
      installationId: 42,
      config: CONFIG,
      supabase: supabase as never,
    });

    expect(outcome.ok).toBe(true);
    // Repo 999 vanished from the installation: its selection flags must be
    // cleared so generateEvidenceForSelected's stale sweep deletes its
    // evidence on the next run.
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].values).toMatchObject({
      selected_for_evidence: false,
      show_publicly: false,
    });
  });
});

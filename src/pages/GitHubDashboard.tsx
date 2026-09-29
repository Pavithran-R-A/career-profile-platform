import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import type { ProfileWithRelations } from '../lib/profiles/repository';
import type {
  GitHubConnection,
  GitHubRepositoryRecord,
  ProfileEvidence,
} from '../lib/github/types';
import GitHubConnectionCard from '../components/GitHubConnectionCard';
import RepositoryList from '../components/RepositoryList';
import EvidenceList from '../components/EvidenceList';
import { getSupabaseClient } from '../lib/supabase/client';
import { useNoindexMeta } from '../lib/seo/usePageMeta';

interface GitHubConfig {
  configured: boolean;
  slug: string | null;
  installUrl: string | null;
}

interface SyncState {
  loading: boolean;
  repositories: GitHubRepositoryRecord[];
  evidence: ProfileEvidence[];
  connection: GitHubConnection | null;
  error: string | null;
}

function safeErrorMessage(status: number, fallback: string): string {
  if (status === 403) return 'GitHub is not connected to your account.';
  if (status === 404) return 'GitHub is not connected yet.';
  if (status === 429) return 'Plan limit reached for selected repositories.';
  return fallback;
}

export default function GitHubDashboard() {
  useNoindexMeta('GitHub evidence — Career Profile');
  const auth = useAuth();
  const navigate = useNavigate();
  const profileServiceRef = useRef<ProfileService | null>(null);
  if (!profileServiceRef.current) profileServiceRef.current = new ProfileService();
  const profileService = profileServiceRef.current;

  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [ghConfig, setGhConfig] = useState<GitHubConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [installStarting, setInstallStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    loading: false,
    repositories: [],
    evidence: [],
    connection: null,
    error: null,
  });

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        setProfile(p);
        setLoading(false);
      });
    }
  }, [auth, profileService]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

  // Public-safe config probe: drives the truthful not-configured state.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/github/config');
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as GitHubConfig;
        if (!cancelled) setGhConfig(data);
      } catch {
        if (!cancelled) setGhConfig({ configured: false, slug: null, installUrl: null });
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const authedFetch = useCallback(
    async (
      path: string,
      body?: unknown
    ): Promise<{ ok: boolean; status: number; data: unknown }> => {
      const session = (await getSupabaseClient().auth.getSession()).data.session;
      const token = session?.access_token ?? '';
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      return { ok: res.ok, status: res.status, data };
    },
    []
  );

  const loadConnectionData = useCallback(async () => {
    if (!profile) return;

    setSyncState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();

      const { data: connections } = await supabase
        .from('github_connections' as never)
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const connection = (connections as unknown as GitHubConnection[] | null)?.[0] ?? null;

      if (!connection) {
        setSyncState({
          loading: false,
          repositories: [],
          evidence: [],
          connection: null,
          error: null,
        });
        return;
      }

      const [reposResult, evidenceResult] = await Promise.all([
        supabase
          .from('github_repositories' as never)
          .select('*')
          .eq('connection_id', connection.id)
          .order('stars_count', { ascending: false }),
        supabase
          .from('profile_evidence' as never)
          .select('*')
          .eq('profile_id', profile.id)
          .order('observed_at', { ascending: false }),
      ]);

      setSyncState({
        loading: false,
        repositories: (reposResult.data as unknown as GitHubRepositoryRecord[]) ?? [],
        evidence: (evidenceResult.data as unknown as ProfileEvidence[]) ?? [],
        connection,
        error: null,
      });
    } catch {
      setSyncState((prev) => ({
        ...prev,
        loading: false,
        error: 'Could not load your GitHub data. Please retry.',
      }));
    }
  }, [profile]);

  useEffect(() => {
    void loadConnectionData();
  }, [loadConnectionData]);

  const handleStartInstall = useCallback(() => {
    void (async () => {
      setInstallStarting(true);
      setNotice(null);
      try {
        const result = await authedFetch('/api/github/install/start');
        if (!result.ok) {
          setNotice(
            result.status === 503
              ? 'GitHub integration is not configured in this environment.'
              : 'Could not start the GitHub install. Please retry.'
          );
          return;
        }
        const { installUrl, state } = result.data as { installUrl: string; state: string };
        window.location.assign(`${installUrl}?state=${encodeURIComponent(state)}`);
      } catch {
        setNotice('Could not start the GitHub install. Please retry.');
      } finally {
        setInstallStarting(false);
      }
    })();
  }, [authedFetch]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const result = await authedFetch('/api/github/sync');
      if (!result.ok) {
        setNotice(
          safeErrorMessage(
            result.status,
            'GitHub sync failed. If credentials are not configured, sync is unavailable.'
          )
        );
        return;
      }
      await loadConnectionData();
      setNotice('Repositories synced.');
    } catch {
      setNotice('GitHub sync failed. Please retry.');
    } finally {
      setSyncing(false);
    }
  }, [authedFetch, loadConnectionData]);

  const handleDisconnect = useCallback(async () => {
    setNotice(null);
    try {
      const result = await authedFetch('/api/github/disconnect');
      if (!result.ok) {
        setNotice('Could not disconnect GitHub. Please retry.');
        return;
      }
      await loadConnectionData();
    } catch {
      setNotice('Could not disconnect GitHub. Please retry.');
    }
  }, [authedFetch, loadConnectionData]);

  const handleToggleRepository = useCallback(
    async (githubRepoId: number, selected: boolean) => {
      const result = await authedFetch(`/api/github/repositories/${githubRepoId}/select`, {
        value: selected,
      });
      if (!result.ok) {
        setNotice(safeErrorMessage(result.status, 'Could not update repository selection.'));
        return;
      }
      setSyncState((prev) => ({
        ...prev,
        repositories: prev.repositories.map((r) =>
          r.github_repo_id === githubRepoId ? { ...r, selected_for_evidence: selected } : r
        ),
      }));
    },
    [authedFetch]
  );

  const handleToggleEvidencePublic = async (evidenceId: string, isPublic: boolean) => {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('profile_evidence' as never)
      .update({ is_public: isPublic } as never)
      .eq('id', evidenceId);

    if (!error) {
      setSyncState((prev) => ({
        ...prev,
        evidence: prev.evidence.map((e) =>
          e.id === evidenceId ? { ...e, is_public: isPublic } : e
        ),
      }));
    }
  };

  const handleRefresh = () => {
    void loadConnectionData();
  };

  if (auth.status === 'loading' || loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const selectedCount = syncState.repositories.filter((r) => r.selected_for_evidence).length;
  const publicEvidenceCount = syncState.evidence.filter((e) => e.is_public).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-2">GitHub Integration</h1>
            <p className="text-gray-600">
              Connect your GitHub account to build evidence-based profile content.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={syncState.loading}
            className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50">
            {syncState.loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {syncState.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {syncState.error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md mb-6">
          {notice}
        </div>
      )}

      <GitHubConnectionCard
        connection={syncState.connection}
        repositoryCount={syncState.repositories.length}
        selectedCount={selectedCount}
        evidenceCount={syncState.evidence.length}
        publicEvidenceCount={publicEvidenceCount}
        installUrl={ghConfig?.installUrl ?? null}
        configLoading={configLoading}
        onStartInstall={handleStartInstall}
        installStarting={installStarting}
      />

      {syncState.connection && (
        <div className="mt-8 space-y-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50">
              {syncing ? 'Syncing…' : 'Sync repositories'}
            </button>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              className="text-sm border border-red-200 text-red-700 px-4 py-2 rounded-md hover:bg-red-50">
              Disconnect
            </button>
          </div>
          <RepositoryList
            repositories={syncState.repositories}
            onToggleRepository={(id, selected) => {
              const repo = syncState.repositories.find((r) => r.id === id);
              if (repo) void handleToggleRepository(repo.github_repo_id, selected);
            }}
          />
        </div>
      )}

      {syncState.evidence.length > 0 && (
        <div className="mt-8">
          <EvidenceList
            evidence={syncState.evidence}
            onTogglePublic={(id, val) => void handleToggleEvidencePublic(id, val)}
          />
        </div>
      )}

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Evidence items are automatically extracted from commits, pull requests, and releases in
          selected repositories. Private repositories can never be shown publicly.
        </p>
      </div>
    </div>
  );
}

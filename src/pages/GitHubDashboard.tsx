import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import type { ProfileWithRelations } from '../lib/profiles/repository';
import GitHubConnectionCard from '../components/GitHubConnectionCard';
import RepositoryList from '../components/RepositoryList';
import EvidenceList from '../components/EvidenceList';
import { getSupabaseClient } from '../lib/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SyncState {
  loading: boolean;
  repositories: any[];
  evidence: any[];
  connection: any;
  error: string | null;
}

export default function GitHubDashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const profileService = new ProfileService();

  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
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
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

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

      const connection = (connections as Record<string, unknown>[] | null)?.[0] ?? null;

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

      const connectionId = (connection as { id: string }).id;

      const [reposResult, evidenceResult] = await Promise.all([
        supabase
          .from('github_repositories' as never)
          .select('*')
          .eq('connection_id', connectionId)
          .order('stars_count', { ascending: false }),
        supabase
          .from('profile_evidence' as never)
          .select('*')
          .eq('profile_id', profile.id)
          .order('observed_at', { ascending: false }),
      ]);

      setSyncState({
        loading: false,
        repositories: reposResult.data ?? [],
        evidence: evidenceResult.data ?? [],
        connection,
        error: null,
      });
    } catch (err) {
      setSyncState((prev) => ({
        ...prev,
        loading: false,
        error: (err as Error).message,
      }));
    }
  }, [profile]);

  useEffect(() => {
    void loadConnectionData();
  }, [loadConnectionData]);

  const handleToggleRepository = async (repoId: string, selected: boolean) => {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('github_repositories' as never)
      .update({ selected_for_evidence: selected } as never)
      .eq('id', repoId);

    if (!error) {
      setSyncState((prev) => ({
        ...prev,
        repositories: prev.repositories.map((r) =>
          r.id === repoId ? { ...r, selected_for_evidence: selected } : r
        ),
      }));
    }
  };

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

      <GitHubConnectionCard
        connection={syncState.connection}
        repositoryCount={syncState.repositories.length}
        selectedCount={selectedCount}
        evidenceCount={syncState.evidence.length}
        publicEvidenceCount={publicEvidenceCount}
      />

      {syncState.connection && (
        <div className="mt-8">
          <RepositoryList
            repositories={syncState.repositories}
            onToggleRepository={handleToggleRepository}
          />
        </div>
      )}

      {syncState.evidence.length > 0 && (
        <div className="mt-8">
          <EvidenceList evidence={syncState.evidence} onTogglePublic={handleToggleEvidencePublic} />
        </div>
      )}

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Evidence items are automatically extracted from commits, pull requests, and releases in
          selected repositories.
        </p>
      </div>
    </div>
  );
}

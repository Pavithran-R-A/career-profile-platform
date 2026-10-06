import type { GitHubConnection } from '../lib/github/types';

interface GitHubConnectionCardProps {
  connection: GitHubConnection | null;
  repositoryCount: number;
  selectedCount: number;
  evidenceCount: number;
  publicEvidenceCount: number;
  /** Server-provided install entry point; null when the App is not configured. */
  installUrl: string | null;
  configLoading: boolean;
  /** Begins the signed install flow (server issues state, then redirects). */
  onStartInstall: () => void;
  installStarting: boolean;
}

function statusColor(status: GitHubConnection['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'inactive':
      return 'bg-gray-100 text-gray-600';
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export default function GitHubConnectionCard({
  connection,
  repositoryCount,
  selectedCount,
  evidenceCount,
  publicEvidenceCount,
  installUrl,
  configLoading,
  onStartInstall,
  installStarting,
}: GitHubConnectionCardProps) {
  if (!connection) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <div>
            <h3 className="text-lg font-medium">GitHub Connection</h3>
            <p className="text-sm text-gray-500">No connection established</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-4 text-center">
          {configLoading ? (
            <p className="text-gray-500">Checking GitHub integration…</p>
          ) : installUrl ? (
            <>
              <p className="text-gray-600 mb-3">
                Install the CareerProfile Go GitHub App on your account to get started.
              </p>
              <button
                type="button"
                onClick={onStartInstall}
                disabled={installStarting}
                className="inline-block bg-gray-900 text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50">
                {installStarting ? 'Opening GitHub…' : 'Install GitHub App'}
              </button>
            </>
          ) : (
            <p className="text-gray-600">
              GitHub evidence isn’t available in this preview yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <div className="flex-1">
          <h3 className="text-lg font-medium">GitHub Connection</h3>
          <p className="text-sm text-gray-500">
            {connection.github_account_login} ({connection.github_account_type})
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColor(connection.status)}`}>
          {connection.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-2xl font-semibold">{repositoryCount}</p>
          <p className="text-xs text-gray-500">Repositories</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-2xl font-semibold">{selectedCount}</p>
          <p className="text-xs text-gray-500">Selected</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-2xl font-semibold">{evidenceCount}</p>
          <p className="text-xs text-gray-500">Evidence Items</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-2xl font-semibold">{publicEvidenceCount}</p>
          <p className="text-xs text-gray-500">Public</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-100 pt-4">
        <span>Connected {new Date(connection.connected_at).toLocaleDateString()}</span>
        {connection.last_synced_at && (
          <span>Last synced {new Date(connection.last_synced_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { GitHubRepositoryRecord } from '../lib/github/types';

interface RepositoryListProps {
  repositories: GitHubRepositoryRecord[];
  onToggleRepository: (repoId: string, selected: boolean) => void;
}

export default function RepositoryList({ repositories, onToggleRepository }: RepositoryListProps) {
  const [filter, setFilter] = useState<'all' | 'selected' | 'unselected'>('all');

  const filtered = repositories.filter((repo) => {
    switch (filter) {
      case 'selected':
        return repo.selected_for_evidence;
      case 'unselected':
        return !repo.selected_for_evidence;
      default:
        return true;
    }
  });

  const selectedCount = repositories.filter((r) => r.selected_for_evidence).length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Repositories</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {selectedCount}/{repositories.length} selected
          </span>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'selected', 'unselected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1 rounded-md capitalize ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          {repositories.length === 0
            ? 'No repositories found. Try refreshing.'
            : 'No repositories match the current filter.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((repo) => (
            <div
              key={repo.id}
              className={`flex items-center gap-4 p-3 rounded-md border ${
                repo.selected_for_evidence
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-100 hover:bg-gray-50'
              }`}>
              <input
                type="checkbox"
                checked={repo.selected_for_evidence}
                onChange={(e) => onToggleRepository(repo.id, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm hover:underline truncate">
                    {repo.full_name}
                  </a>
                  {repo.is_private && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                      Private
                    </span>
                  )}
                  {repo.is_fork && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      Fork
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{repo.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {repo.primary_language && <span>{repo.primary_language}</span>}
                  {repo.stars_count > 0 && <span>&#9733; {repo.stars_count}</span>}
                  {repo.forks_count > 0 && <span>&#9741; {repo.forks_count}</span>}
                </div>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={repo.show_publicly}
                  onChange={() => {}}
                  disabled
                  className="w-4 h-4 rounded border-gray-300 opacity-50"
                  title="Show publicly (requires evidence selection)"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

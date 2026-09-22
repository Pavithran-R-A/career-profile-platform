import { useState } from 'react';
import type { ProfileEvidence } from '../lib/github/types';

interface EvidenceListProps {
  evidence: ProfileEvidence[];
  onTogglePublic: (evidenceId: string, isPublic: boolean) => void;
}

const evidenceTypeLabels: Record<ProfileEvidence['evidence_type'], string> = {
  commit: 'Commit',
  pull_request: 'Pull Request',
  issue: 'Issue',
  release: 'Release',
  code_review: 'Code Review',
  contribution: 'Contribution',
  project: 'Project',
};

const evidenceTypeColors: Record<ProfileEvidence['evidence_type'], string> = {
  commit: 'bg-green-100 text-green-700',
  pull_request: 'bg-purple-100 text-purple-700',
  issue: 'bg-blue-100 text-blue-700',
  release: 'bg-orange-100 text-orange-700',
  code_review: 'bg-yellow-100 text-yellow-700',
  contribution: 'bg-cyan-100 text-cyan-700',
  project: 'bg-gray-100 text-gray-700',
};

export default function EvidenceList({ evidence, onTogglePublic }: EvidenceListProps) {
  const [typeFilter, setTypeFilter] = useState<ProfileEvidence['evidence_type'] | 'all'>('all');

  const filtered =
    typeFilter === 'all' ? evidence : evidence.filter((e) => e.evidence_type === typeFilter);

  const typeCounts = evidence.reduce(
    (acc, e) => {
      acc[e.evidence_type] = (acc[e.evidence_type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Evidence Items</h3>
        <span className="text-sm text-gray-500">{evidence.length} total</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setTypeFilter('all')}
          className={`text-xs px-2 py-1 rounded-md ${
            typeFilter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          All ({evidence.length})
        </button>
        {(Object.keys(typeCounts) as Array<ProfileEvidence['evidence_type']>).map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`text-xs px-2 py-1 rounded-md ${
              typeFilter === type
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {evidenceTypeLabels[type]} ({typeCounts[type]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          No evidence items found. Select repositories and sync to generate evidence.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-md border ${
                item.is_public ? 'border-green-200 bg-green-50' : 'border-gray-100'
              }`}>
              <span
                className={`text-xs px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0 ${
                  evidenceTypeColors[item.evidence_type]
                }`}>
                {evidenceTypeLabels[item.evidence_type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm hover:underline truncate">
                      {item.subject}
                    </a>
                  ) : (
                    <span className="font-medium text-sm truncate">{item.subject}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.summary}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {item.source_path && (
                    <span className="truncate max-w-[200px]">{item.source_path}</span>
                  )}
                  {item.source_commit_sha && (
                    <span className="font-mono">{item.source_commit_sha.slice(0, 7)}</span>
                  )}
                  <span>{new Date(item.observed_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.is_public}
                    onChange={(e) => onTogglePublic(item.id, e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300"
                  />
                  Public
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

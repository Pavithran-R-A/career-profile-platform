interface TailoringSuggestion {
  section: 'experience' | 'education' | 'skills' | 'projects';
  action: 'add' | 'modify' | 'highlight' | 'remove';
  originalText?: string;
  suggestedText: string;
  reason: string;
  requirementIds: string[];
  applied: boolean;
}

interface TailoringReviewProps {
  suggestions: TailoringSuggestion[];
  onApply: (index: number) => void;
  onReject: (index: number) => void;
}

const ACTION_LABELS: Record<TailoringSuggestion['action'], string> = {
  add: 'Add',
  modify: 'Modify',
  highlight: 'Highlight',
  remove: 'Remove',
};

const SECTION_LABELS: Record<TailoringSuggestion['section'], string> = {
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
};

export default function TailoringReview({ suggestions, onApply, onReject }: TailoringReviewProps) {
  const appliedCount = suggestions.filter((s) => s.applied).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Tailoring Suggestions</h2>
        <span className="text-sm text-gray-500">
          {appliedCount}/{suggestions.length} applied
        </span>
      </div>

      {suggestions.length === 0 ? (
        <p className="text-gray-500">No tailoring suggestions at this time.</p>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => {
            return (
              <div
                key={`suggestion-${index}`}
                className={`border rounded-lg p-4 ${
                  suggestion.applied ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {SECTION_LABELS[suggestion.section]}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {ACTION_LABELS[suggestion.action]}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-2">{suggestion.reason}</p>

                    {suggestion.originalText && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Current:</p>
                        <p className="text-xs text-gray-600 line-through">
                          {suggestion.originalText}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-0.5">Suggested:</p>
                      <p className="text-xs text-gray-800">{suggestion.suggestedText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onApply(index)}
                      disabled={suggestion.applied}
                      className={`text-xs px-3 py-1 rounded-md ${
                        suggestion.applied
                          ? 'bg-green-500 text-white cursor-default'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}>
                      {suggestion.applied ? 'Applied' : 'Accept'}
                    </button>
                    <button
                      onClick={() => onReject(index)}
                      disabled={!suggestion.applied}
                      className={`text-xs px-3 py-1 rounded-md ${
                        !suggestion.applied
                          ? 'bg-gray-100 text-gray-500 cursor-default'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}>
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

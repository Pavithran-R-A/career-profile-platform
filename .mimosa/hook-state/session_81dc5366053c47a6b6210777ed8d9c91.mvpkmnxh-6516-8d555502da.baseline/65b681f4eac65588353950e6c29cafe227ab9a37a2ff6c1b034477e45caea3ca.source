interface JobRequirement {
  id: string;
  category: 'must_have' | 'nice_to_have' | 'preferred';
  text: string;
  matched: boolean;
  matchedFrom?: string;
  confidence: number;
}

interface RequirementAnalysisProps {
  jobTitle: string;
  companyName: string;
  matchScore: number;
  requirements: JobRequirement[];
  summary: string;
}

export default function RequirementAnalysis({
  jobTitle,
  companyName,
  matchScore,
  requirements,
  summary,
}: RequirementAnalysisProps) {
  const mustHaves = requirements.filter((r) => r.category === 'must_have');
  const niceToHaves = requirements.filter((r) => r.category === 'nice_to_have');

  const matchedCount = requirements.filter((r) => r.matched).length;
  const scoreColor =
    matchScore >= 80 ? 'text-green-600' : matchScore >= 50 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg =
    matchScore >= 80
      ? 'bg-green-50 border-green-200'
      : matchScore >= 50
        ? 'bg-yellow-50 border-yellow-200'
        : 'bg-red-50 border-red-200';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{jobTitle}</h2>
        <p className="text-gray-600">{companyName}</p>
      </div>

      <div className={`rounded-lg p-6 border ${scoreBg}`}>
        <div className="flex items-center gap-4">
          <span className={`text-4xl font-bold ${scoreColor}`}>{matchScore}%</span>
          <div>
            <p className="font-medium text-gray-900">Match Score</p>
            <p className="text-sm text-gray-600">
              {matchedCount} of {requirements.length} requirements matched
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-3">{summary}</p>
      </div>

      {mustHaves.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Required ({mustHaves.filter((r) => r.matched).length}/{mustHaves.length} matched)
          </h3>
          <div className="space-y-2">
            {mustHaves.map((req) => (
              <div
                key={req.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  req.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                <span
                  className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                    req.matched ? 'bg-green-500 text-white' : 'bg-red-400 text-white'
                  }`}>
                  {req.matched ? '✓' : '✗'}
                </span>
                <div className="flex-1">
                  <p className="text-sm">{req.text}</p>
                  {req.matched && req.matchedFrom && (
                    <p className="text-xs text-green-700 mt-0.5">Matched from: {req.matchedFrom}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {niceToHaves.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Nice to Have ({niceToHaves.filter((r) => r.matched).length}/{niceToHaves.length}{' '}
            matched)
          </h3>
          <div className="space-y-2">
            {niceToHaves.map((req) => (
              <div
                key={req.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  req.matched ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}>
                <span
                  className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                    req.matched ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                  {req.matched ? '✓' : '–'}
                </span>
                <div className="flex-1">
                  <p className="text-sm">{req.text}</p>
                  {req.matched && req.matchedFrom && (
                    <p className="text-xs text-green-700 mt-0.5">Matched from: {req.matchedFrom}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import RequirementAnalysis from '../components/RequirementAnalysis';
import TailoringReview from '../components/TailoringReview';
import type { ProfileWithRelations } from '../lib/profiles/repository';

type TailoringState =
  'input' | 'analyzing' | 'analysis' | 'tailoring' | 'review' | 'complete' | 'error';

interface JobRequirement {
  id: string;
  category: 'must_have' | 'nice_to_have' | 'preferred';
  text: string;
  matched: boolean;
  matchedFrom?: string;
  confidence: number;
}

interface TailoringSuggestion {
  section: 'experience' | 'education' | 'skills' | 'projects';
  action: 'add' | 'modify' | 'highlight' | 'remove';
  originalText?: string;
  suggestedText: string;
  reason: string;
  requirementIds: string[];
  applied: boolean;
}

interface TailoringResult {
  jobTitle: string;
  companyName: string;
  matchScore: number;
  requirements: JobRequirement[];
  suggestions: TailoringSuggestion[];
  summary: string;
}

function parseJobDescription(text: string): {
  jobTitle: string;
  companyName: string;
  requirements: string[];
} {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let jobTitle = 'Untitled Position';
  let companyName = 'Unknown Company';
  const requirements: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.includes('about the role') ||
      lower.includes('about us') ||
      lower.includes('job title') ||
      lower.includes('position:')
    ) {
      const match = line.match(/[:\-]\s*(.+)/);
      if (match) jobTitle = match[1].trim();
    }
    if (lower.includes('company:') || lower.includes('employer:')) {
      const match = line.match(/[:\-]\s*(.+)/);
      if (match) companyName = match[1].trim();
    }
    if (
      lower.startsWith('-') ||
      lower.startsWith('•') ||
      lower.startsWith('*') ||
      lower.startsWith('–')
    ) {
      requirements.push(line.replace(/^[\-\•\*\–]\s*/, '').trim());
    }
  }

  if (lines.length > 0 && jobTitle === 'Untitled Position') {
    jobTitle = lines[0];
  }
  if (lines.length > 1 && companyName === 'Unknown Company') {
    const secondLine = lines[1];
    if (!secondLine.startsWith('-') && !secondLine.startsWith('•')) {
      companyName = secondLine;
    }
  }

  return { jobTitle, companyName, requirements };
}

function analyzeRequirements(
  jobRequirements: string[],
  profile: ProfileWithRelations
): JobRequirement[] {
  const allSkills = profile.skills.map((s) => s.name.toLowerCase());
  const allExperienceText = profile.experiences
    .map((e) => `${e.role} ${e.company} ${e.description || ''}`)
    .join(' ')
    .toLowerCase();
  const allEducationText = profile.education
    .map((e) => `${e.institution} ${e.degree || ''} ${e.field_of_study || ''}`)
    .join(' ')
    .toLowerCase();

  return jobRequirements.map((req, index) => {
    const lowerReq = req.toLowerCase();
    let matched = false;
    let matchedFrom = '';
    let confidence = 0;

    for (const skill of allSkills) {
      if (lowerReq.includes(skill)) {
        matched = true;
        matchedFrom = `Skill: ${skill}`;
        confidence = 0.9;
        break;
      }
    }

    if (!matched) {
      const words = lowerReq.split(/\s+/).filter((w) => w.length > 3);
      for (const word of words) {
        if (allExperienceText.includes(word)) {
          matched = true;
          matchedFrom = 'Experience';
          confidence = 0.6;
          break;
        }
        if (allEducationText.includes(word)) {
          matched = true;
          matchedFrom = 'Education';
          confidence = 0.5;
          break;
        }
      }
    }

    const isNiceToHave =
      lowerReq.includes('nice to have') ||
      lowerReq.includes('preferred') ||
      lowerReq.includes('bonus') ||
      lowerReq.includes('plus');

    return {
      id: `req-${index}`,
      category: isNiceToHave ? 'nice_to_have' : 'must_have',
      text: req,
      matched,
      matchedFrom,
      confidence,
    };
  });
}

function generateSuggestions(
  requirements: JobRequirement[],
  profile: ProfileWithRelations,
  jobTitle: string
): TailoringSuggestion[] {
  const suggestions: TailoringSuggestion[] = [];
  const unmatched = requirements.filter((r) => !r.matched);

  for (const req of unmatched) {
    if (req.category === 'must_have') {
      suggestions.push({
        section: 'skills',
        action: 'add',
        suggestedText: req.text,
        reason: `Required skill not found in your profile: "${req.text}"`,
        requirementIds: [req.id],
        applied: false,
      });
    }
  }

  const primarySkills = profile.skills.slice(0, 5).map((s) => s.name);
  if (primarySkills.length > 0) {
    suggestions.push({
      section: 'skills',
      action: 'highlight',
      suggestedText: primarySkills.join(', '),
      reason: `Highlight your top skills prominently for the "${jobTitle}" role`,
      requirementIds: requirements
        .filter((r) => primarySkills.some((s) => r.text.toLowerCase().includes(s.toLowerCase())))
        .map((r) => r.id),
      applied: true,
    });
  }

  if (profile.experiences.length > 0) {
    suggestions.push({
      section: 'experience',
      action: 'modify',
      originalText: profile.experiences[0].description || undefined,
      suggestedText: profile.experiences[0].description
        ? profile.experiences[0].description
        : `Relevant experience for ${jobTitle}`,
      reason: 'Tailor your most recent experience description to align with this role',
      requirementIds: [],
      applied: false,
    });
  }

  return suggestions;
}

function matchScore(requirements: JobRequirement[]): number {
  if (requirements.length === 0) return 0;
  const matchedCount = requirements.filter((r) => r.matched).length;
  return Math.round((matchedCount / requirements.length) * 100);
}

export default function JobTailoring() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<TailoringState>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [result, setResult] = useState<TailoringResult | null>(null);
  const [suggestions, setSuggestions] = useState<TailoringSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        if (p) setProfile(p);
      });
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      void navigate('/login');
    }
  }, [auth, navigate]);

  const handleAnalyze = () => {
    if (!profile || !jobDescription.trim()) return;
    setState('analyzing');

    try {
      const { jobTitle, companyName, requirements } = parseJobDescription(jobDescription);

      const enrichedRequirements =
        requirements.length > 0
          ? requirements
          : jobDescription
              .split(/[.\n]/)
              .map((s) => s.trim())
              .filter((s) => s.length > 10);

      const analyzed = analyzeRequirements(enrichedRequirements, profile);
      const score = matchScore(analyzed);
      const suggs = generateSuggestions(analyzed, profile, jobTitle);

      const tailoringResult: TailoringResult = {
        jobTitle,
        companyName,
        matchScore: score,
        requirements: analyzed,
        suggestions: suggs,
        summary: `You match ${score}% of the requirements for this ${jobTitle} position at ${companyName}.`,
      };

      setResult(tailoringResult);
      setSuggestions(suggs);
      setState('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze job description');
      setState('error');
    }
  };

  const handleApplySuggestion = (index: number) => {
    setSuggestions((prev) => prev.map((s, i) => (i === index ? { ...s, applied: true } : s)));
  };

  const handleRejectSuggestion = (index: number) => {
    setSuggestions((prev) => prev.map((s, i) => (i === index ? { ...s, applied: false } : s)));
  };

  const handleFinish = () => {
    setState('complete');
    setTimeout(() => {
      void navigate('/dashboard/resume/ats');
    }, 2000);
  };

  if (auth.status === 'loading') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Job Description Tailoring</h1>
        <button
          onClick={() => void navigate('/dashboard')}
          className="text-gray-600 hover:text-gray-900">
          ← Back to dashboard
        </button>
      </div>

      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6"
          role="alert">
          {error}
        </div>
      )}

      {state === 'input' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
            Paste a job description below. We will analyze it against your profile and suggest
            tailored changes.
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Job Description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              placeholder={`Paste the full job description here, including:\n- Job title and company\n- Required skills and qualifications\n- Nice-to-have requirements\n- Responsibilities`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!jobDescription.trim() || !profile}
            className="bg-gray-900 text-white py-2 px-6 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
            Analyze &amp; Tailor
          </button>
        </div>
      )}

      {state === 'analyzing' && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing job requirements...</p>
        </div>
      )}

      {state === 'analysis' && result && (
        <div className="space-y-8">
          <RequirementAnalysis
            jobTitle={result.jobTitle}
            companyName={result.companyName}
            matchScore={result.matchScore}
            requirements={result.requirements}
            summary={result.summary}
          />

          <TailoringReview
            suggestions={suggestions}
            onApply={handleApplySuggestion}
            onReject={handleRejectSuggestion}
          />

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleFinish}
              className="bg-gray-900 text-white py-2 px-6 rounded-md hover:bg-gray-800">
              Continue to Builder
            </button>
            <button
              onClick={() => setState('input')}
              className="border border-gray-300 text-gray-700 py-2 px-6 rounded-md hover:bg-gray-50">
              Start Over
            </button>
          </div>
        </div>
      )}

      {state === 'complete' && (
        <div className="text-center py-12">
          <div className="text-green-500 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">Tailoring complete! Redirecting to ATS builder...</p>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={() => {
              setState('input');
              setError(null);
            }}
            className="bg-gray-900 text-white py-2 px-6 rounded-md hover:bg-gray-800">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

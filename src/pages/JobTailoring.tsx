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

  const currentStage =
    state === 'input' || state === 'error'
      ? 1
      : state === 'analyzing' || state === 'analysis'
        ? 2
        : 3;
  const stages = ['Job', 'Profile evidence', 'Tailored output'];

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="page-title">Job tailoring</h1>
          <p className="page-subtitle">
            Select the most relevant truth from your existing profile — nothing is invented.
          </p>
        </div>
        <button onClick={() => void navigate('/dashboard')} className="link-quiet text-sm">
          ← Back to dashboard
        </button>
      </div>

      {/* Three-stage workflow rail */}
      <ol className="grid grid-cols-3 gap-2 sm:gap-3 mb-6" aria-label="Tailoring workflow progress">
        {stages.map((label, i) => {
          const n = i + 1;
          const active = n === currentStage;
          const done = n < currentStage;
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className={`rounded-xl border px-3 sm:px-4 py-3 flex items-center gap-2.5 transition-colors ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : done
                    ? 'border-[var(--success-border)] bg-[var(--success-surface)]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
              }`}>
              <span
                aria-hidden="true"
                className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                  done
                    ? 'bg-[var(--success)] text-white'
                    : active
                      ? 'text-white'
                      : 'bg-[var(--surface-muted)] text-[var(--faint-foreground)]'
                }`}
                style={active ? { background: 'var(--accent)' } : undefined}>
                {done ? '✓' : n}
              </span>
              <span
                className={`text-[11px] sm:text-[13px] font-semibold leading-tight ${active ? 'text-[var(--ink)]' : 'text-[var(--muted-foreground)]'}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="alert alert-error mb-5" role="alert">
          {error}
        </div>
      )}

      {state === 'input' && (
        <div className="card card-pad space-y-5">
          <div>
            <h2 className="section-title">Paste the job description</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              We analyze it against your profile and show which requirements you already meet.
            </p>
          </div>

          <div>
            <label htmlFor="job-description" className="field-label">
              Job description
            </label>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              placeholder={`Paste the full job description here, including:\n- Job title and company\n- Required skills and qualifications\n- Nice-to-have requirements\n- Responsibilities`}
              className="w-full px-3 py-2.5 border border-[var(--border-strong)] rounded-xl bg-white text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!jobDescription.trim() || !profile}
              className="btn btn-primary">
              Analyze &amp; Tailor
            </button>
            <p className="text-xs text-[var(--faint-foreground)]">
              Runs against your own profile — your text stays in your account.
            </p>
          </div>
        </div>
      )}

      {state === 'analyzing' && (
        <div className="card card-pad text-center py-14" role="status" aria-live="polite">
          <div
            className="spinner w-8 h-8 mx-auto mb-4"
            style={{ borderBottomColor: 'var(--accent)' }}></div>
          <p className="text-sm font-medium text-[var(--ink)]">Analyzing job requirements…</p>
          <p className="text-xs text-[var(--faint-foreground)] mt-1">
            Matching requirements against your experience, education and skills.
          </p>
        </div>
      )}

      {state === 'analysis' && result && (
        <div className="space-y-6">
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

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border)]">
            <button onClick={handleFinish} className="btn btn-primary">
              Continue to Builder
            </button>
            <button onClick={() => setState('input')} className="btn btn-secondary">
              Start Over
            </button>
          </div>
        </div>
      )}

      {state === 'complete' && (
        <div className="card card-pad text-center py-14" role="status" aria-live="polite">
          <div className="text-[var(--success)] mb-4">
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
          <p className="text-sm font-medium text-[var(--ink)]">
            Tailoring complete! Redirecting to the ATS builder…
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="card card-pad text-center py-12">
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Something went wrong. Please try again.
          </p>
          <button
            onClick={() => {
              setState('input');
              setError(null);
            }}
            className="btn btn-primary">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

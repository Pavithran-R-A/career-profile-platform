import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { useNoindexMeta } from '../lib/seo/usePageMeta';
import { parseJobDescription } from '../lib/resume/job-parser';
import {
  matchRequirements,
  MatchStrength,
  type RequirementMatch,
} from '../lib/resume/requirement-matcher';
import { getSupabaseClient } from '../lib/supabase/client';
import { track } from '../lib/analytics/events';
import type { ProfileWithRelations } from '../lib/profiles/repository';

type TailoringState = 'input' | 'analyzing' | 'result' | 'error';

const PRIORITY_LABELS: Record<string, string> = {
  required: 'Required',
  preferred: 'Preferred',
  niceToHave: 'Nice to have',
};

function strengthLabel(strength: RequirementMatch['strength']): string | null {
  switch (strength) {
    case MatchStrength.exact:
      return 'Exact match in your profile';
    case MatchStrength.strong:
      return 'Strong match in your profile';
    case MatchStrength.moderate:
      return 'Partial match in your profile';
    case MatchStrength.weak:
      return 'Weak signal in your profile';
    default:
      return null;
  }
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad" aria-labelledby={title.replace(/\s+/g, '-').toLowerCase()}>
      <h2 id={title.replace(/\s+/g, '-').toLowerCase()} className="section-title mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function JobTailoring() {
  useNoindexMeta('Job tailoring — Career Profile');
  const auth = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<TailoringState>('input');
  const [jobDescription, setJobDescription] = useState('');
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedVariant, setSavedVariant] = useState<{
    title: string;
    company: string | null;
  } | null>(null);

  const analysisRef = useRef<HTMLDivElement>(null);
  const profileServiceRef = useRef<ProfileService | null>(null);
  if (!profileServiceRef.current) profileServiceRef.current = new ProfileService();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileServiceRef.current!.getProfile(auth.user.id).then((p) => {
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
    setError(null);

    try {
      const parsed = parseJobDescription(jobDescription);
      const matching = matchRequirements(parsed, profile);

      if (parsed.requirements.length === 0) {
        setState('error');
        setError(
          'No clear requirements were found. Paste the section of the posting that lists skills, experience and qualifications as bullet points.'
        );
        return;
      }

      // Persist the analysis as a private variant row (schema: name /
      // target_role / target_company / job_requirements / variant_data).
      void (async () => {
        try {
          const supabase = getSupabaseClient();
          await supabase.from('profile_variants').insert({
            profile_id: profile.id,
            name: parsed.title,
            target_role: parsed.title,
            target_company: parsed.company,
            job_description_sha256: null,
            job_requirements: parsed.requirements,
            variant_data: {
              summary: matching.summary,
              overallScore: matching.overallScore,
              gaps: matching.gaps.map((g) => g.text).slice(0, 20),
              createdAt: new Date().toISOString(),
            },
          });
          setSavedVariant({ title: parsed.title, company: parsed.company });
        } catch {
          // Variant bookkeeping must never fail the analysis; leave unsaved.
          setSavedVariant(null);
        }
      })();

      track('tailoring_started', { source: 'job_tailoring' });
      // The analysis result was produced (deterministic, client-side).
      track('tailoring_completed', {
        source: 'job_tailoring',
        count: parsed.requirements.length,
      });
      setState('result');
    } catch {
      setState('error');
      setError(
        'Something went wrong while analyzing the description. Check the text and try again.'
      );
    }
  };

  const renderMatches = (matches: RequirementMatch[]) => (
    <ul className="space-y-2.5">
      {matches.map((match, i) => {
        const label = strengthLabel(match.strength);
        const matched = match.strength !== MatchStrength.none;
        return (
          <li
            key={`${match.requirement.text}-${i}`}
            className={`rounded-lg border p-3.5 ${
              matched
                ? 'border-[var(--success-border)] bg-[var(--success-surface)]'
                : 'border-[var(--border)] bg-[var(--surface-warm)]'
            }`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-[var(--ink)] leading-snug">{match.requirement.text}</p>
              <span className="shrink-0 text-[11px] font-semibold text-[var(--muted-foreground)]">
                {PRIORITY_LABELS[match.requirement.priority] ?? 'Requirement'}
              </span>
            </div>
            {label && (
              <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--success)' }}>
                {label}
              </p>
            )}
            {match.matchedEvidence.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {match.matchedEvidence.slice(0, 3).map((ev, j) => (
                  <li key={j} className="text-xs text-[var(--muted-foreground)]">
                    <span aria-hidden="true">↳ </span>
                    {ev}
                  </li>
                ))}
              </ul>
            )}
            {match.gapSuggestions.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {match.gapSuggestions.slice(0, 2).map((s, j) => (
                  <li key={j} className="text-xs text-[var(--warning)]">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (auth.status === 'loading') {
    return (
      <div className="page-shell">
        <div className="skeleton h-9 w-56" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (auth.status === 'unauthenticated') {
    return null;
  }

  if (state === 'input' || state === 'error') {
    return (
      <div className="page-shell">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Job tailoring</h1>
            <p className="page-subtitle">
              Match a job description against your own profile — nothing is invented, nothing is
              scored.
            </p>
          </div>
          <button onClick={() => void navigate('/dashboard')} className="link-quiet text-sm">
            ← Back to dashboard
          </button>
        </div>

        {error && (
          <div className="alert alert-error mb-5" role="alert">
            {error}
          </div>
        )}

        <div className="card card-pad space-y-5">
          <div>
            <h2 className="section-title">Paste the job description</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              We extract its requirements and check each one against your experience, education,
              skills and projects — showing the evidence we found, and the gaps we honestly
              can&apos;t cover.
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
              Analyze requirements
            </button>
            <p className="text-xs text-[var(--faint-foreground)]">
              Runs against your own profile — your text stays in your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'analyzing') {
    return (
      <div className="page-shell">
        <div className="card card-pad text-center py-14" role="status" aria-live="polite">
          <div
            className="spinner w-8 h-8 mx-auto mb-4"
            style={{ borderBottomColor: 'var(--accent)' }}
          />
          <p className="text-sm font-medium text-[var(--ink)]">Analyzing job requirements…</p>
          <p className="text-xs text-[var(--faint-foreground)] mt-1">
            Matching requirements against your experience, education and skills.
          </p>
        </div>
      </div>
    );
  }

  // Result state
  const parsed = parseJobDescription(jobDescription);
  const matching = matchRequirements(parsed, profile!);
  const { summary } = matching;
  const matchedCount = summary.matched;
  const totalRequirements = summary.totalRequirements;
  const matched = matching.matches.filter(
    (m) => m.strength === MatchStrength.exact || m.strength === MatchStrength.strong
  );
  const partial = matching.matches.filter(
    (m) => m.strength === MatchStrength.moderate || m.strength === MatchStrength.weak
  );
  const gaps = matching.matches.filter((m) => m.strength === MatchStrength.none);
  const suggestedSkills = profile!.skills
    .filter((s) => parsed.requirements.some((r) => r.normalized.includes(s.name.toLowerCase())))
    .map((s) => s.name);

  return (
    <div className="page-shell" ref={analysisRef}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
            Analysis complete
          </p>
          <h1 className="page-title truncate">{parsed.title}</h1>
          <p className="page-subtitle">
            {parsed.company ? `${parsed.company} · ` : ''}
            {matchedCount} of {totalRequirements} requirements clearly covered
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setState('input')} className="btn btn-secondary !min-h-[40px]">
            New analysis
          </button>
          <Link to="/dashboard/resume/ats" className="btn btn-primary !min-h-[40px]">
            Build the resume
          </Link>
        </div>
      </div>

      {savedVariant && (
        <div className="alert alert-success mb-5" role="status">
          Saved as a private tailored version
          {savedVariant.company ? ` for ${savedVariant.company}` : ''} — find it later in your
          dashboard.
        </div>
      )}

      <div className="space-y-5">
        <SectionBlock title="Requirements & evidence">{renderMatches(matched)}</SectionBlock>

        {partial.length > 0 && (
          <SectionBlock title="Partial matches">
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              These are only partially covered. Check the wording before including them anywhere.
            </p>
            {renderMatches(partial)}
          </SectionBlock>
        )}

        {gaps.length > 0 && (
          <SectionBlock title="Potential gaps">
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              We found no evidence for these in your profile. Don&apos;t add them unless they are
              genuinely true for you.
            </p>
            {renderMatches(gaps)}
          </SectionBlock>
        )}

        <SectionBlock title="Suggested for the tailored version">
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Based on the requirements above, include these in the ATS resume you build for this
            role. Nothing is changed on your base profile.
          </p>
          {suggestedSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestedSkills.map((skill) => (
                <span key={skill} className="chip">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              No profile skills exactly match this posting&apos;s wording — review the requirements
              above and pick relevant ones yourself in the ATS builder.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/dashboard/resume/ats" className="btn btn-primary">
              Open ATS builder
            </Link>
            <Link to="/dashboard/preview" className="btn btn-secondary">
              Preview portfolio
            </Link>
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}

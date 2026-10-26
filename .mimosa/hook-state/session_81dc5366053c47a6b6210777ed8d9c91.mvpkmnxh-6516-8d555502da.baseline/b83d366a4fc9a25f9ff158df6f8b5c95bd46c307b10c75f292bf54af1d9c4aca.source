import { useEffect, useRef, useState } from 'react';
import {
  askRecruiterQuestion,
  fetchRecruiterConfig,
  RecruiterAskError,
  sectionLabel,
  type RecruiterConfig,
  type RecruiterAnswer,
} from '../lib/recruiter/ask';

const SUGGESTIONS = [
  'What kind of roles is this person strongest for?',
  'Summarize their most recent experience.',
  'What technologies do they actually have evidence for?',
  'What projects show end-to-end ownership?',
];

type PanelState = 'idle' | 'loading' | 'answered' | 'error';

/**
 * Recruiter-facing Q&A on a public profile. Renders only when the deployment
 * has the recruiter assistant enabled; otherwise renders nothing at all.
 * Answers come strictly from the published profile; the sections the answer
 * used are shown as citations. No scoring, ranking, or hiring decisions —
 * this is a reading aid for the profile.
 */
export default function RecruiterAsk({ username }: { username: string }) {
  const [config, setConfig] = useState<RecruiterConfig | null>(null);
  const [question, setQuestion] = useState('');
  const [state, setState] = useState<PanelState>('idle');
  const [answer, setAnswer] = useState<RecruiterAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchRecruiterConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hidden until the deployment turns the assistant on. Nothing renders —
  // not even a disabled box — so drafts and disabled environments are clean.
  if (!config || !config.enabled) return null;

  const maxChars = config.maxQuestionChars;

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length > maxChars || state === 'loading') return;
    setState('loading');
    setError(null);
    setAnswer(null);
    try {
      const result = await askRecruiterQuestion(username, trimmed);
      setAnswer(result);
      setState('answered');
      requestAnimationFrame(() => answerRef.current?.focus());
    } catch (err) {
      if (err instanceof RecruiterAskError) {
        if (err.code === 'AI_NOT_CONFIGURED' || err.code === 'SERVER_NOT_CONFIGURED') {
          setError('The assistant is not available on this deployment right now.');
        } else if (err.code === 'RATE_LIMITED') {
          setError(
            'The daily question limit for this profile has been reached. Try again tomorrow.'
          );
        } else if (err.code === 'TOO_MANY_REQUESTS') {
          const wait = err.retryAfterSeconds
            ? ` Try again in about ${err.retryAfterSeconds}s.`
            : ' Try again in a minute.';
          setError('Too many questions in a short time.' + wait);
        } else if (err.code === 'PROFILE_NOT_FOUND') {
          setError('This profile is no longer available.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
      setState('error');
    }
  };

  return (
    <section
      aria-labelledby="recruiter-ask-heading"
      className="border-t border-[var(--border)] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
          For recruiters
        </p>
        <h2 id="recruiter-ask-heading" className="section-title mt-1.5">
          Ask about this profile
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1.5">
          Answers come only from what this candidate published — every fact is tied to the profile
          section it came from. Nothing is invented, inferred, or scored.
        </p>

        {SUGGESTIONS.length > 0 && state === 'idle' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  void ask(s);
                }}
                className="chip text-left hover:border-[var(--border-strong)]">
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="mt-4 flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}>
          <label htmlFor="recruiter-question" className="sr-only">
            Your question about this profile
          </label>
          <input
            id="recruiter-question"
            value={question}
            maxLength={maxChars}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What did they build most recently?"
            className="field-input flex-1"
          />
          <button
            type="submit"
            disabled={!question.trim() || question.length > maxChars || state === 'loading'}
            className="btn btn-primary !min-h-[44px] shrink-0">
            {state === 'loading' ? 'Reading the profile…' : 'Ask'}
          </button>
        </form>

        {state === 'loading' && (
          <div className="mt-4 card card-pad" role="status" aria-live="polite">
            <p className="text-sm text-[var(--muted-foreground)]">Reading the published profile…</p>
          </div>
        )}

        {state === 'error' && error && (
          <div className="alert alert-error mt-4" role="alert">
            {error}
          </div>
        )}

        {state === 'answered' && answer && (
          <div
            ref={answerRef}
            tabIndex={-1}
            className="mt-4 card card-pad outline-none"
            aria-live="polite">
            <p className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-line">
              {answer.answer}
            </p>
            {answer.sections.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--border)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--faint-foreground)]">
                  Based on
                </p>
                <ul
                  className="mt-2 flex flex-wrap gap-1.5"
                  aria-label="Profile sections cited for this answer">
                  {answer.sections.map((s) => (
                    <li key={s} className="chip text-xs">
                      {sectionLabel(s)}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-[var(--faint-foreground)] mt-2">
                  The answer cites only these published sections. It may not cover every statement,
                  and anything not in the profile is not answered.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

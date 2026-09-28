import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ResumeService } from '../lib/resume/service';
import { ProfileService } from '../lib/profiles/service';
import { toCustomerMessage } from '../lib/resume/errors';
import { resumeExtractionSchema } from '../lib/ai/provider';
import type { ResumeExtraction } from '../lib/ai/provider';
import {
  applyResumeImport,
  buildImportPayload,
  type ImportSectionKey,
  type ResumeImportSummary,
} from '../lib/resume/import';
import { buildReviewModel, REVIEW_SECTION_KEYS, type ReviewModel } from '../lib/resume/review';
import { track } from '../lib/analytics/events';
import { useNoindexMeta } from '../lib/seo/usePageMeta';
import { getSupabaseClient } from '../lib/supabase/client';
import type { ProfileWithRelations } from '../lib/profiles/repository';

type ResumeState =
  | 'empty'
  | 'uploading'
  | 'extracting'
  | 'structuring'
  | 'review'
  | 'applying'
  | 'complete'
  | 'error';

interface StuckReview {
  resumeId: string;
  filename: string;
  draft: ResumeExtraction | null;
  status: string;
}

const PREVIEW_LIMIT = 3;

export class ExtractionFailure extends Error {
  code?: string;
  userMessage?: string;
}

async function loadPendingReview(profileId: string): Promise<StuckReview | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('resume_sources')
    .select('id, original_filename, status, structured_draft, updated_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as {
    id: string;
    original_filename: string;
    status: string;
    structured_draft: ResumeExtraction | null;
    updated_at: string;
  } | null;

  if (!row) return null;
  if (row.status !== 'structured' && row.status !== 'error') return null;

  let draft: ResumeExtraction | null = null;
  if (row.structured_draft) {
    const parsed = resumeExtractionSchema.safeParse(row.structured_draft);
    if (parsed.success) draft = parsed.data;
  }

  if (!draft && row.status !== 'error') return null;

  // Only offer pickup for recent attempts (stuck states older than 10 min
  // are treated as abandoned).
  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  if (ageMs > 10 * 60 * 1000) return null;

  return { resumeId: row.id, filename: row.original_filename, draft, status: row.status };
}

export default function ResumeImport() {
  const auth = useAuth();
  useNoindexMeta('Import resume — Career Profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ResumeState>('empty');
  const [error, setError] = useState<string | null>(null);
  const [extractionBlocked, setExtractionBlocked] = useState(false);
  const [existingProfile, setExistingProfile] = useState<ProfileWithRelations | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [currentResume, setCurrentResume] = useState<{ id: string; filename: string } | null>(null);
  const [draft, setDraft] = useState<ResumeExtraction | null>(null);
  const [review, setReview] = useState<ReviewModel | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [pendingReview, setPendingReview] = useState<StuckReview | null>(null);
  const [applySummary, setApplySummary] = useState<ResumeImportSummary | null>(null);
  const [droppedNotes, setDroppedNotes] = useState<string[]>([]);

  const profileId = existingProfile?.id ?? null;

  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.user) return;
    let cancelled = false;

    void (async () => {
      try {
        const profile = await new ProfileService().getProfile(auth.user.id);
        if (cancelled) return;
        setExistingProfile(profile);
        setProfileLoaded(true);
        if (profile) {
          setPendingReview(await loadPendingReview(profile.id));
        }
      } catch {
        if (!cancelled) setProfileLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth]);

  const updateResumeStatusSafely = useCallback(
    async (
      resumeId: string,
      status: Parameters<ResumeService['updateResumeStatus']>[1],
      extra?: {
        structuredDraft?: ResumeExtraction;
        warnings?: string[];
        errorMessage?: string;
      }
    ) => {
      const supabase = getSupabaseClient();
      try {
        const service = new ResumeService(
          import.meta.env.VITE_SUPABASE_URL as string,
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          supabase
        );
        await service.updateResumeStatus(
          resumeId,
          status,
          extra?.structuredDraft,
          extra?.warnings,
          extra?.errorMessage
        );
      } catch {
        // Status bookkeeping must never fail the user's flow.
      }
    },
    []
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profileId) return;

    setState('uploading');
    setError(null);
    setExtractionBlocked(false);
    setUploadedFile({ name: file.name, size: file.size });

    let savedResumeId: string | null = null;
    try {
      const supabase = getSupabaseClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      const service = new ResumeService(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        supabase
      );

      const resume = await service.uploadResume(session.user.id, profileId, file);
      savedResumeId = resume.id;
      setCurrentResume({ id: resume.id, filename: file.name });
      track('resume_uploaded', { source: 'resume_import' });
      setState('extracting');
      void updateResumeStatusSafely(resume.id, 'extracting');

      const extractionResult = await extractAndStructure(resume.id);
      const extraction = extractionResult as unknown as ResumeExtraction;
      const validated = resumeExtractionSchema.safeParse(extraction);
      if (!validated.success) {
        throw new Error('Extraction result was not in the expected format.');
      }

      setDraft(validated.data);
      void updateResumeStatusSafely(resume.id, 'structured', {
        structuredDraft: validated.data,
        warnings: validated.data.warnings,
      });
      enterReview(validated.data);
    } catch (err) {
      if (err instanceof ExtractionFailure) {
        setDraft(null);
        if (err.code === 'AI_NOT_CONFIGURED') {
          // The upload itself succeeded; say so plainly.
          setExtractionBlocked(true);
          setState('empty');
          return;
        }
        if (savedResumeId) {
          void updateResumeStatusSafely(savedResumeId, 'error', {
            errorMessage: err.message,
          });
        }
        setError(
          err.userMessage ||
            'Your resume was saved, but we could not structure it right now. You can retry, or add the details manually in the profile editor.'
        );
        setState('error');
        return;
      }
      setError(toCustomerMessage(err, 'save'));
      setState('error');
    }
  };

  const extractAndStructure = async (resumeSourceId: string): Promise<unknown> => {
    setState('structuring');

    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let response: Response;
    try {
      response = await fetch('/api/resume/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ resumeSourceId }),
      });
    } catch {
      throw new ExtractionFailure('Network error while contacting the extraction service.');
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON body; treat as a generic failure.
    }

    if (!response.ok) {
      const errorData = (body ?? {}) as { error?: string; code?: string };
      const notConfigured =
        errorData.code === 'AI_NOT_CONFIGURED' ||
        errorData.error === 'AI extraction is not configured';
      const failure = new ExtractionFailure(errorData.error || 'Extraction failed');
      failure.code = notConfigured ? 'AI_NOT_CONFIGURED' : errorData.code;
      if (notConfigured) {
        failure.userMessage =
          'Your resume was saved and read successfully. AI profile extraction isn\u2019t available right now.';
      } else if (errorData.code === 'PDF_NO_TEXT') {
        failure.userMessage =
          'This PDF appears to be scanned or has too little readable text. Add the details manually in the profile editor.';
      }
      throw failure;
    }

    return body;
  };

  const enterReview = (extraction: ResumeExtraction) => {
    const model = buildReviewModel(existingProfile, extraction);
    setReview(model);
    setSelectedSections(new Set(model.safeKeys));
    setState('review');
  };

  const resumeSavedReview = (pending: StuckReview) => {
    if (!pending.draft) return;
    setDraft(pending.draft);
    setCurrentResume({ id: pending.resumeId, filename: pending.filename });
    setPendingReview(null);
    enterReview(pending.draft);
  };

  const retryExtraction = () => {
    if (!currentResume) return;
    setPendingReview(null);
    setError(null);
    setExtractionBlocked(false);
    void (async () => {
      setState('extracting');
      try {
        const extraction = (await extractAndStructure(
          currentResume.id
        )) as unknown as ResumeExtraction;
        const validated = resumeExtractionSchema.safeParse(extraction);
        if (!validated.success)
          throw new Error('Extraction result was not in the expected format.');
        setDraft(validated.data);
        void updateResumeStatusSafely(currentResume.id, 'structured', {
          structuredDraft: validated.data,
          warnings: validated.data.warnings,
        });
        enterReview(validated.data);
      } catch (err) {
        if (err instanceof ExtractionFailure) {
          if (err.code === 'AI_NOT_CONFIGURED') {
            setExtractionBlocked(true);
            setState('empty');
            return;
          }
          setError(
            err.userMessage || 'We could not structure your resume right now. Please try again.'
          );
          setState('error');
          return;
        }
        setError(toCustomerMessage(err, 'save'));
        setState('error');
      }
    })();
  };

  const handleApply = async (sectionsToApply: Set<string>) => {
    if (!draft || !profileId) return;

    setState('applying');
    setError(null);

    try {
      if (currentResume) void updateResumeStatusSafely(currentResume.id, 'applying');

      const sectionKeys: ImportSectionKey[] = [...sectionsToApply].map((k) =>
        k === 'identity' ? 'basics' : (k as ImportSectionKey)
      );
      const { payload, droppedNotes: notes } = buildImportPayload({
        profileId,
        extraction: draft,
        selected: new Set(sectionKeys),
      });

      const summary = await applyResumeImport(payload);

      if (currentResume) void updateResumeStatusSafely(currentResume.id, 'applied');
      track('resume_extraction_reviewed', {
        source: 'resume_import',
        section: [...sectionsToApply].join(',').slice(0, 32) || undefined,
        count: sectionsToApply.size,
      });

      setApplySummary(summary);
      setDroppedNotes(notes);
      setState('complete');
    } catch (err) {
      if (currentResume) {
        void updateResumeStatusSafely(currentResume.id, 'error', {
          errorMessage: err instanceof Error ? err.message : 'apply failed',
        });
      }
      setError(toCustomerMessage(err, 'save'));
      setState('error');
    }
  };

  const applyAllSafe = () => {
    if (!review) return;
    const safe = new Set<string>();
    for (const key of REVIEW_SECTION_KEYS) {
      const section = review.sections.find((s) => s.key === key);
      if (section?.hasProposal && section.safe) safe.add(key);
    }
    void handleApply(safe);
  };

  const toggleSection = (section: string) => {
    const next = new Set(selectedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setSelectedSections(next);
  };

  const reset = () => {
    setState('empty');
    setDraft(null);
    setReview(null);
    setSelectedSections(new Set());
    setError(null);
    setExtractionBlocked(false);
    setApplySummary(null);
    setDroppedNotes([]);
  };

  if (auth.status !== 'authenticated') {
    return null;
  }

  const selectedHasProposal = review
    ? [...selectedSections].some((key) =>
        review.sections.some((s) => s.key === key && s.hasProposal)
      )
    : false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Import resume</h1>
          <p className="page-subtitle">Turn an existing PDF into structured profile data.</p>
        </div>
        <Link to="/dashboard" className="link-quiet text-sm">
          ← Back to dashboard
        </Link>
      </div>

      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6"
          role="alert">
          {error}
        </div>
      )}

      {extractionBlocked && state === 'empty' && (
        <div
          className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6"
          role="status">
          <p className="font-medium">Resume saved.</p>
          <p className="text-sm mt-1">
            Automatic extraction isn't available on this environment. Your file is safe on your
            account — add the details manually, or retry extraction later.
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            <Link
              to="/dashboard/profile"
              className="bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 text-sm">
              Add details manually
            </Link>
            {currentResume && (
              <button
                type="button"
                onClick={retryExtraction}
                className="border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 text-sm">
                Retry extraction
              </button>
            )}
            <button
              type="button"
              onClick={() => setExtractionBlocked(false)}
              className="border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 text-sm">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {state === 'empty' && (
        <div className="card p-8 sm:p-12 text-center">
          {profileLoaded && pendingReview && (
            <div className="mb-8 text-left rounded-xl border border-[var(--border-strong)] bg-[var(--surface-warm)] p-5">
              <p className="text-sm font-semibold text-[var(--ink)]">Pick up where you left off</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {pendingReview.filename} was
                {pendingReview.status === 'structured'
                  ? ' read and structured, but the review was not finished.'
                  : ' processed but needs attention.'}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {pendingReview.draft && (
                  <button
                    type="button"
                    onClick={() => resumeSavedReview(pendingReview)}
                    className="btn btn-primary !min-h-[44px] !py-2.5">
                    Review extracted data
                  </button>
                )}
                {pendingReview.status === 'error' && (
                  <button
                    type="button"
                    onClick={retryExtraction}
                    className="btn btn-secondary !min-h-[44px] !py-2.5">
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPendingReview(null)}
                  className="btn btn-secondary !min-h-[44px] !py-2.5">
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-6">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h2
            className="text-[var(--ink)]"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.5rem, 1.2rem + 1.4vw, 2.25rem)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}>
            Turn your existing resume into structured data
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-3 max-w-md mx-auto leading-relaxed">
            Upload the PDF you already use for applications. We read it, then let you review
            everything before anything touches your profile.
          </p>

          <ol className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-1 max-w-2xl mx-auto text-left">
            {[
              ['1', 'Upload', 'Stored privately on your account'],
              ['2', 'Review', 'Experience, education and skills extracted'],
              ['3', 'Apply', 'You choose what gets added'],
            ].map(([n, title, body], i, arr) => (
              <li key={n} className="flex sm:flex-1 items-center gap-1 sm:gap-2 min-w-0">
                <div className="flex-1 rounded-xl border border-[var(--border)] p-3.5 bg-[var(--surface-warm)] min-w-0">
                  <span
                    className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--ink)' }}>
                    {n}
                  </span>
                  <p className="text-sm font-semibold text-[var(--ink)] mt-2">{title}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-snug">
                    {body}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <svg
                    className="hidden sm:block shrink-0 text-[var(--faint-foreground)]"
                    width="18"
                    height="10"
                    viewBox="0 0 18 10"
                    fill="none"
                    aria-hidden="true">
                    <path
                      d="M0 5h13m0 0-4-4m4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            ))}
          </ol>

          <p className="text-xs text-[var(--faint-foreground)] mt-6">
            PDF files up to 6 MiB, maximum 20 pages
          </p>
          {!profileLoaded ? (
            <p className="text-sm text-[var(--faint-foreground)] mt-5" role="status">
              Preparing upload…
            </p>
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => void handleFileSelect(e)}
              className="hidden"
              aria-label="Resume PDF file"
            />
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary mt-5 !min-h-[48px] !px-8"
            disabled={!profileLoaded}>
            Select PDF
          </button>
        </div>
      )}

      {(state === 'uploading' || state === 'extracting' || state === 'structuring') && (
        <div className="card p-8 sm:p-10" role="status" aria-live="polite">
          <div className="flex flex-col sm:flex-row items-center gap-5 max-w-lg mx-auto text-center sm:text-left">
            <div className="w-14 h-14 rounded-2xl bg-[var(--surface-warm)] border border-[var(--border)] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-[var(--accent)]">PDF</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--ink)] truncate">
                {uploadedFile?.name ?? 'Your resume.pdf'}
              </p>
              <p className="text-xs text-[var(--faint-foreground)] mt-0.5">
                {uploadedFile ? `${(uploadedFile.size / 1024 / 1024).toFixed(1)} MiB` : ''}
              </p>
              <p className="text-sm mt-2.5 flex items-center gap-2 justify-center sm:justify-start">
                <span
                  className="inline-block w-4 h-4 rounded-full border-2 border-[var(--border-strong)] animate-spin border-t-transparent"
                  aria-hidden="true"
                />
                <span style={{ color: 'var(--accent-text)' }}>
                  {state === 'uploading'
                    ? 'Uploading securely…'
                    : state === 'extracting'
                      ? 'Reading your resume…'
                      : 'Structuring your profile…'}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {state === 'review' && draft && review && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
            <p>
              Review what we extracted from <strong>{uploadedFile?.name ?? 'your resume'}</strong>.
              Safe items (nothing to overwrite, duplicates auto-skipped) are pre-selected. Nothing
              changes until you apply.
            </p>
          </div>

          <div className="space-y-4">
            {review.sections
              .filter((section) => section.hasProposal || section.existingCount > 0)
              .map((section) => (
                <div
                  key={section.key}
                  className="border border-gray-200 rounded-lg p-4"
                  role="group"
                  aria-labelledby={`review-${section.key}`}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSections.has(section.key)}
                      onChange={() => toggleSection(section.key)}
                      disabled={!section.hasProposal}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <h3
                        id={`review-${section.key}`}
                        className="font-medium flex flex-wrap items-center gap-2">
                        {section.title}
                        {section.hasProposal && (
                          <span className="text-xs font-normal text-gray-500">
                            {section.proposedCount} proposed
                          </span>
                        )}
                        {section.existingCount > 0 && (
                          <span className="text-xs font-normal text-gray-500">
                            · {section.existingCount} existing
                          </span>
                        )}
                        {!section.safe && section.hasProposal && (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                            Needs your call
                          </span>
                        )}
                      </h3>

                      {section.existingCount > 0 && (
                        <p className="text-xs text-[var(--faint-foreground)] mt-1.5">
                          <span className="font-semibold text-[var(--muted-foreground)]">
                            On your profile:
                          </span>{' '}
                          {section.existingPreview.join(' · ') || '—'}
                          {section.existingCount > PREVIEW_LIMIT && ' …'}
                        </p>
                      )}

                      {section.hasProposal && (
                        <ul className="text-sm text-gray-700 mt-1.5 space-y-0.5">
                          {section.proposalPreview.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                          {section.proposedCount > PREVIEW_LIMIT && (
                            <li className="text-xs text-gray-500">
                              +{section.proposedCount - PREVIEW_LIMIT} more
                            </li>
                          )}
                        </ul>
                      )}

                      {section.conflictNotes.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {section.conflictNotes.map((note, i) => (
                            <li
                              key={i}
                              className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                              {note}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </label>
                </div>
              ))}

            {review.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2">Review notes from extraction</h3>
                {review.warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-yellow-700">
                    {warning}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleApply(selectedSections)}
              disabled={!selectedHasProposal}
              className="btn btn-primary !min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed">
              Apply selected items ({selectedSections.size})
            </button>
            <button
              type="button"
              onClick={applyAllSafe}
              className="btn btn-secondary !min-h-[44px]">
              Apply all safe items
            </button>
            <button type="button" onClick={reset} className="btn btn-secondary !min-h-[44px]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === 'applying' && (
        <div className="text-center py-12" role="status">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-gray-600">Applying your changes…</p>
        </div>
      )}

      {state === 'complete' && (
        <div className="card p-8 sm:p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-green-600"
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
          <h2 className="text-xl font-semibold text-[var(--ink)]">Profile updated</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-2 max-w-md mx-auto">
            {applySummary
              ? summarizeApply(applySummary)
              : 'Your resume import has been applied to your profile.'}
          </p>

          {(droppedNotes.length > 0 || (draft?.warnings?.length ?? 0) > 0) && (
            <div className="mt-4 text-left max-w-md mx-auto bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-yellow-800 mb-1.5">Skipped or unclear</p>
              {[...droppedNotes, ...(draft?.warnings ?? [])].map((note, i) => (
                <p key={i} className="text-xs text-yellow-700">
                  {note}
                </p>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard/preview" className="btn btn-primary !min-h-[44px]">
              Preview portfolio
            </Link>
            <Link to="/dashboard/resume/ats" className="btn btn-secondary !min-h-[44px]">
              Generate ATS resume
            </Link>
            <Link to="/dashboard" className="btn btn-secondary !min-h-[44px]">
              Go to dashboard
            </Link>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-1 font-medium">Something went wrong.</p>
          <p className="text-sm text-gray-500 mb-4">
            Your resume file is still saved on your account — nothing was lost.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                reset();
                if (currentResume) void retryExtraction();
              }}
              className="btn btn-primary !min-h-[44px]">
              Try again
            </button>
            <Link to="/dashboard/profile" className="btn btn-secondary !min-h-[44px]">
              Add details manually
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function summarizeApply(summary: ResumeImportSummary): string {
  const parts: string[] = [];
  const labels: Array<[keyof ResumeImportSummary['inserted'], string]> = [
    ['experience', 'experience entries'],
    ['education', 'education entries'],
    ['projects', 'projects'],
    ['skills', 'skills'],
    ['links', 'links'],
  ];
  for (const [key, label] of labels) {
    const n = summary.inserted[key] ?? 0;
    if (n > 0) parts.push(`${n} ${label}`);
  }
  const skipped = Object.values(summary.skipped ?? {}).reduce((a, b) => a + b, 0);
  const base = parts.length > 0 ? `Added ${parts.join(', ')}.` : 'No new entries were needed.';
  const extra = skipped > 0 ? ` ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped.` : '';
  return `${base}${extra}`;
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import { profileCompletion } from '../lib/profiles/completion';
import { getPreferences, type ProfilePreferences } from '../lib/profiles/preferences';
import { getSupabaseClient } from '../lib/supabase/client';
import { useNoindexMeta } from '../lib/seo/usePageMeta';
import { oncePerSession, track } from '../lib/analytics/events';
import PublishControls from '../components/PublishControls';
import { TemplateCanvas } from '../components/portfolio/TemplateCanvas';
import type { ProfileWithRelations } from '../lib/profiles/repository';

const QUICK_ACTIONS = [
  { to: '/dashboard/profile', label: 'Edit profile', hint: 'Basics, experience, skills, links' },
  { to: '/dashboard/resume', label: 'Import resume', hint: 'Start from your existing PDF' },
  { to: '/dashboard/resume/ats', label: 'ATS resume', hint: 'Build a parseable PDF' },
  { to: '/dashboard/resume/tailor', label: 'Job tailoring', hint: 'Match a job description' },
];

function CompletionRing({ percentage }: { percentage: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative w-[132px] h-[132px] shrink-0"
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Profile completion">
      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-muted)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percentage / 100)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden="true">
        <span className="text-2xl font-bold text-[var(--ink)]">{percentage}%</span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--faint-foreground)]">
          complete
        </span>
      </div>
    </div>
  );
}

interface ResumeStatusRow {
  original_filename: string;
  status: string;
  created_at: string;
}

interface BetaFunnelCounts {
  resume_uploaded: number;
  portfolio_published: number;
  ats_downloaded: number;
  profile_completed: number;
}

const EMPTY_PROFILE_KEYS = ['experiences', 'education', 'projects', 'skills', 'links'] as const;

function profileIsEmpty(profile: ProfileWithRelations): boolean {
  return EMPTY_PROFILE_KEYS.every((key) => profile[key].length === 0);
}

const RESUME_STATUS_LABELS: Record<string, string> = {
  uploaded: 'Saved',
  extracting: 'Reading',
  extracted: 'Ready to review',
  structuring: 'Structuring',
  structured: 'Ready to review',
  applying: 'Applying',
  applied: 'Applied to profile',
  error: 'Needs attention',
};

function nextBestAction(summary: ReturnType<typeof profileCompletion>, isPublished: boolean) {
  const incomplete = summary.items.find((i) => !i.completed);
  if (incomplete) {
    return {
      title: `Finish ${incomplete.label.toLowerCase()}`,
      body: `Your ${incomplete.label.toLowerCase()} section is the next thing recruiters will look for.`,
      cta: 'Continue your profile',
      to: '/dashboard/profile',
    };
  }
  if (!isPublished) {
    return {
      title: 'Publish your portfolio',
      body: 'Everything required is in place. Preview it, then publish to get your shareable link.',
      cta: 'Go to publish',
      to: '#live-card',
    };
  }
  return {
    title: 'Tailor your next application',
    body: 'Your profile and portfolio are live. Match them against a job description next.',
    cta: 'Start tailoring',
    to: '/dashboard/resume/tailor',
  };
}

export default function Dashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  useNoindexMeta('Dashboard — Career Profile');
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences | null>(null);
  const [resume, setResume] = useState<ResumeStatusRow | null | 'loading'>('loading');
  const [betaFunnel, setBetaFunnel] = useState<BetaFunnelCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        setProfile(p);
        setLoading(false);
        if (p) {
          void getPreferences(p.id)
            .then(setPreferences)
            .catch(() => setPreferences(null));
          void (async () => {
            try {
              const { data } = await getSupabaseClient()
                .from('resume_sources')
                .select('original_filename, status, created_at')
                .eq('profile_id', p.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              setResume((data as ResumeStatusRow | null) ?? null);
            } catch {
              setResume(null);
            }
          })();
        }
      });
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      setLoading(false);
    }
  }, [auth]);

  // Private-beta funnel visibility: the owner's own milestone counts.
  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.user) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await getSupabaseClient()
          .from('funnel_events')
          .select('event_name');
        const rows = (data ?? []) as Array<{ event_name: string }>;
        const counts: BetaFunnelCounts = {
          resume_uploaded: 0,
          portfolio_published: 0,
          ats_downloaded: 0,
          profile_completed: 0,
        };
        for (const row of rows) {
          if (row.event_name in counts) counts[row.event_name as keyof BetaFunnelCounts] += 1;
        }
        if (!cancelled) setBetaFunnel(counts);
      } catch {
        if (!cancelled) setBetaFunnel(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

  useEffect(() => {
    if (!loading && auth.status === 'authenticated' && !profile) {
      void navigate('/onboarding');
    }
  }, [loading, auth, profile, navigate]);

  // Funnel: a fully complete profile counts as profile_completed (once/session).
  useEffect(() => {
    if (!profile) return;
    const percentage = profileCompletion(profile).percentage;
    if (percentage === 100 && oncePerSession(`profile-complete:${profile.id}`)) {
      track('profile_completed', { source: 'dashboard' });
    }
  }, [profile]);

  if (auth.status === 'loading' || loading) {
    return (
      <div className="page-shell">
        <div className="space-y-4" aria-label="Loading dashboard" role="status">
          <div className="skeleton h-9 w-64" />
          <div className="skeleton h-44 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
            <div className="skeleton h-64" />
            <div className="skeleton h-64" />
            <div className="skeleton h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const summary = profileCompletion(profile);
  const isPublished = profile.visibility === 'published';
  const isEmpty = profileIsEmpty(profile);
  const publicUrl = `${window.location.origin}/u/${profile.username}`;
  const action = nextBestAction(summary, isPublished);
  const templateKey = preferences?.template_key || 'minimal';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const setVisibility = (published: boolean) =>
    setProfile({
      ...profile,
      visibility: published ? 'published' : 'draft',
      published_at: published ? new Date().toISOString() : null,
    });

  return (
    <div className="page-shell">
      {/* Top */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-[var(--faint-foreground)]">Welcome back,</p>
          <h1 className="page-title">{profile.display_name || profile.username}</h1>
          <p className="page-subtitle">
            {isPublished
              ? 'Your portfolio is live and ready to share.'
              : summary.percentage < 100
                ? 'Your profile is taking shape — keep going.'
                : 'Your profile is complete and waiting to go live.'}
          </p>
        </div>
        <Link
          to="/dashboard/preview"
          className="link-underline text-sm font-semibold flex items-center gap-1.5"
          style={{ color: 'var(--accent-text)' }}>
          Preview portfolio →
        </Link>
      </div>

      {/* Empty new account: one obvious next action */}
      {isEmpty && !isPublished && (
        <section className="card p-6 sm:p-8 mb-6" aria-labelledby="build-heading">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
            First step
          </p>
          <h2 id="build-heading" className="section-title mt-2">
            Build your profile
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1.5 max-w-xl leading-relaxed">
            The fastest way is to import the CV you already use. We structure it, you review
            every line, and only what you approve lands in your profile.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/dashboard/resume" className="btn btn-primary !min-h-[44px] !py-2.5">
              Import CV
            </Link>
            <Link to="/dashboard/profile" className="btn btn-secondary !min-h-[44px] !py-2.5">
              Start manually
            </Link>
          </div>
        </section>
      )}

      {/* Dominant live-state card */}
      <section
        id="live-card"
        className="scroll-mt-24 card overflow-hidden"
        aria-label="Your portfolio">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
          <div className="p-6 sm:p-8 flex flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`status-chip ${isPublished ? 'status-chip-live' : ''}`}>
                {profile.visibility}
              </span>
              <span className="text-sm text-[var(--muted-foreground)]">
                {isPublished ? 'Your portfolio is live' : 'Private until you publish'}
              </span>
            </div>

            {isPublished ? (
              <div className="mt-5">
                <p
                  className="font-mono text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--accent-text)] truncate"
                  title={publicUrl}>
                  {publicUrl.replace(window.location.origin, '')}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/u/${profile.username}`}
                    className="btn btn-primary !min-h-[44px] !py-2.5">
                    Open portfolio
                  </Link>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="btn btn-secondary !min-h-[44px] !py-2.5">
                    {copied ? 'Copied ✓' : 'Copy link'}
                  </button>
                  <span role="status" aria-live="polite" className="sr-only">
                    {copied ? 'Link copied to clipboard' : ''}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary !min-h-[44px] !py-2.5"
                  onClick={() =>
                    document.getElementById('publish-controls')?.scrollIntoView({ block: 'center' })
                  }>
                  Publish my portfolio
                </button>
                <Link
                  to="/dashboard/appearance"
                  className="btn btn-secondary !min-h-[44px] !py-2.5">
                  Pick a style first
                </Link>
              </div>
            )}

            <div className="mt-auto pt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--faint-foreground)]">
              <span>Last updated {new Date(profile.updated_at).toLocaleDateString()}</span>
              <span>
                Template:{' '}
                <span className="font-semibold text-[var(--muted-foreground)] capitalize">
                  {templateKey}
                </span>
              </span>
            </div>

            <div id="publish-controls" className="mt-5 pt-5 border-t border-[var(--border)]">
              <PublishControls
                profileId={profile.id}
                isPublished={isPublished}
                onPublishChange={setVisibility}
              />
            </div>
          </div>

          {/* Real selected-template thumbnail */}
          <div className="border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-[var(--surface-warm)] p-4 sm:p-6 flex items-center">
            <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-white shadow-[var(--shadow-card)] w-full">
              <div className="flex items-center gap-2 px-3.5 py-2 border-b border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
                <span className="ml-2 text-[11px] text-[var(--faint-foreground)] truncate">
                  /u/{profile.username}
                </span>
              </div>
              <TemplateCanvas
                templateKey={templateKey}
                profile={profile}
                preferences={
                  preferences
                    ? {
                        accentKey: preferences.accent_key,
                        sectionOrder: preferences.section_order,
                        hiddenSections: preferences.hidden_sections,
                      }
                    : undefined
                }
                scale={0.52}
                height={300}
                label={`Your ${templateKey} portfolio thumbnail`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
        {/* 1. Profile completion */}
        <section className="card card-pad" aria-labelledby="completion-heading">
          <h2 id="completion-heading" className="section-title">
            Profile completion
          </h2>
          <div className="mt-5 flex items-center gap-5">
            <CompletionRing percentage={summary.percentage} />
            <ul className="flex-1 space-y-2">
              {summary.items.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5 text-sm">
                  <span
                    aria-hidden="true"
                    className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      item.completed
                        ? 'bg-[var(--success)] text-white'
                        : 'bg-[var(--surface-muted)] text-[var(--faint-foreground)]'
                    }`}>
                    {item.completed ? '✓' : '·'}
                  </span>
                  <span
                    className={
                      item.completed ? 'text-[var(--ink)]' : 'text-[var(--muted-foreground)]'
                    }>
                    {item.label}
                  </span>
                  <span className="ml-auto text-[11px] text-[var(--faint-foreground)]">
                    {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 2. Next best action */}
        <section className="card card-pad flex flex-col" aria-labelledby="nba-heading">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
            Next best action
          </p>
          <h2 id="nba-heading" className="section-title mt-2">
            {action.title}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-2 leading-relaxed flex-1">
            {action.body}
          </p>
          {action.to.startsWith('#') ? (
            <a href={action.to} className="btn btn-primary btn-block mt-5">
              {action.cta}
            </a>
          ) : (
            <Link to={action.to} className="btn btn-primary btn-block mt-5">
              {action.cta}
            </Link>
          )}
        </section>

        {/* 3. Quick actions */}
        <section
          className="card card-pad md:col-span-2 xl:col-span-1"
          aria-labelledby="quick-heading">
          <h2 id="quick-heading" className="section-title">
            Quick actions
          </h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
            {QUICK_ACTIONS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-4 py-3 bg-white hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card)] transition-all">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--ink)]">
                    {link.label}
                  </span>
                  <span className="block text-xs text-[var(--faint-foreground)] truncate">
                    {link.hint}
                  </span>
                </span>
                <span aria-hidden="true" className="text-[var(--faint-foreground)]">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* CV import status — real resume_sources data */}
      <section className="card card-pad mt-6" aria-labelledby="cv-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="cv-heading" className="section-title">
              CV import
            </h2>
            {resume === 'loading' && (
              <p className="text-sm text-[var(--faint-foreground)] mt-1">Checking your imports…</p>
            )}
            {resume === null && (
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                No resume imported yet — upload your PDF to pre-fill your profile.
              </p>
            )}
            {resume && resume !== 'loading' && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span
                  aria-hidden="true"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: 'var(--accent)' }}>
                  PDF
                </span>
                <span className="text-sm font-semibold text-[var(--ink)]">
                  {resume.original_filename}
                </span>
                <span className="status-chip">
                  {RESUME_STATUS_LABELS[resume.status] ?? resume.status}
                </span>
                <span className="text-xs text-[var(--faint-foreground)]">
                  {new Date(resume.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <Link to="/dashboard/resume" className="btn btn-secondary !min-h-[44px] !py-2.5">
            {resume && resume !== 'loading' ? 'Import another' : 'Import your CV'}
          </Link>
        </div>
      </section>

      {/* Private-beta funnel visibility (own events only, no vanity metrics) */}
      {betaFunnel && (
        <section className="mt-6" aria-label="Private beta funnel">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--faint-foreground)]">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-[var(--muted-foreground)]">
              Private beta funnel
            </span>
            <span>CV imports: {betaFunnel.resume_uploaded}</span>
            <span>Published: {betaFunnel.portfolio_published}</span>
            <span>ATS downloads: {betaFunnel.ats_downloaded}</span>
            <span>Completed: {betaFunnel.profile_completed}</span>
          </div>
        </section>
      )}
    </div>
  );
}

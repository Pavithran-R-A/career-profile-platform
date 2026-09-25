import { Link } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { DEMO_PROFILE } from '../lib/demo/fixture';
import { getTemplate, type TemplateConfig } from '../lib/templates/types';
import { ensureTemplatesRegistered, getTemplateComponent } from '../lib/templates/registry';

const STEPS = [
  {
    title: 'Start with what you already have',
    body: 'Upload your CV as a PDF, or fill in your details by hand. Either way you end up with one structured profile.',
  },
  {
    title: 'One source of truth',
    body: 'Experience, education, projects and skills live in one place — edit once, use everywhere.',
  },
  {
    title: 'Use it everywhere',
    body: 'Publish a portfolio link, export an ATS-ready resume, and tailor your profile to a job description.',
  },
];

function FlowChips() {
  const chips = ['Your CV', 'Career profile', 'ATS resume', 'Portfolio'];
  return (
    <ol
      className="flex flex-wrap items-center gap-x-2 gap-y-2"
      aria-label="How Career Profile works">
      {chips.map((chip, i) => (
        <li key={chip} className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full border border-white/20 text-white/90 bg-white/5">
            {chip}
          </span>
          {i < chips.length - 1 && (
            <span aria-hidden="true" className="text-white/60 text-xs">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function MiniProfileCard() {
  const roles = DEMO_PROFILE.experiences.slice(0, 2);
  const skills = DEMO_PROFILE.skills.slice(0, 5);
  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-pop)] border border-black/5 p-5 text-left">
      <p className="text-[13px] font-bold text-[#0b1220] tracking-tight">
        {DEMO_PROFILE.display_name}
      </p>
      <p className="text-xs text-gray-500">{DEMO_PROFILE.headline}</p>
      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
        {roles.map((r) => (
          <div key={r.id} className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold text-gray-800 truncate">{r.role}</span>
            <span className="text-[10px] text-gray-500 shrink-0">
              {r.start_year}–{r.is_current ? 'now' : r.end_year}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span
            key={s.id}
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExamplePortfolioFrame() {
  // Idempotent: keeps the demo working regardless of bootstrap/test order.
  ensureTemplatesRegistered();
  const template = getTemplate('minimal');
  const Component = getTemplateComponent('minimal');
  const config: TemplateConfig = template!.config;
  return (
    <div className="card overflow-hidden shadow-[var(--shadow-pop)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[#f2f3f5]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
        <span className="ml-3 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-0.5 truncate">
          /u/{DEMO_PROFILE.username}
        </span>
      </div>
      <div className="relative overflow-hidden bg-white" style={{ height: 440 }}>
        <div
          aria-hidden="true"
          className="absolute top-0 left-0"
          style={{ width: '138.9%', transform: 'scale(0.72)', transformOrigin: 'top left' }}>
          <Component profile={DEMO_PROFILE} config={config} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

export default function Home() {
  const auth = useAuth();
  const primaryTo = auth.status === 'authenticated' ? '/dashboard' : '/signup';
  const primaryLabel = auth.status === 'authenticated' ? 'Go to dashboard' : 'Create your profile';

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-14 sm:pt-20 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center">
          <div>
            <p className="t-eyebrow">Built for job seekers</p>
            <h1 className="t-display mt-4">One profile. Built for recruiters.</h1>
            <p className="t-lead mt-5 max-w-xl">
              Upload your CV and get a structured career profile, an ATS-ready resume, and a
              portfolio you can share — without fighting a website builder.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to={primaryTo} className="btn btn-primary w-full sm:w-auto">
                {primaryLabel}
              </Link>
              <Link to="/#example" className="btn btn-secondary w-full sm:w-auto">
                See an example
              </Link>
            </div>
            <p className="mt-4 text-xs text-[var(--faint-foreground)]">
              Free to start · Export your resume anytime · Yours to publish when ready
            </p>
          </div>

          {/* Product demonstration panel */}
          <div className="relative rounded-2xl bg-[#0b1220] p-6 sm:p-7 shadow-[var(--shadow-pop)]">
            <FlowChips />
            <div className="mt-6 flex justify-center">
              <div className="w-full max-w-[320px]">
                <MiniProfileCard />
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-white/70">
              Your CV becomes a profile recruiters can scan in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-[var(--border)] bg-white scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-16">
          <p className="t-eyebrow">How it works</p>
          <h2 className="t-h1 mt-3 max-w-2xl">
            From a document you already have to a profile people actually read
          </h2>
          <ol className="mt-9 grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative pl-11">
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 w-7 h-7 rounded-full bg-[var(--ink)] text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <h3 className="t-h2">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Made for recruiters to scan */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="t-eyebrow">Made for recruiters to scan</p>
            <h2 className="t-h1 mt-3">Clear beats clever.</h2>
            <p className="t-lead mt-4">
              Recruiters spend seconds on a first pass. Your profile uses familiar sections, plain
              language and honest structure — so the right details surface immediately.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              [
                'Standard sections',
                'Experience, education, projects and skills in the layout recruiters expect.',
              ],
              ['ATS-ready resume', 'A clean, parseable PDF you can attach to any application.'],
              ['Job tailoring', 'Paste a job description and see which of your details match it.'],
            ].map(([title, body]) => (
              <li key={title} className="card card-pad flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 w-5 h-5 rounded-full bg-[var(--success-surface)] border border-[var(--success-border)] text-[var(--success)] text-[11px] font-bold flex items-center justify-center shrink-0">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
                  <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Example portfolio */}
      <section id="example" className="border-t border-[var(--border)] bg-white scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="t-eyebrow">Example portfolio</p>
              <h2 className="t-h1 mt-3">This is what sharing looks like.</h2>
            </div>
            <Link to="/signup" className="btn btn-secondary w-full sm:w-auto">
              Build yours
            </Link>
          </div>
          <ExamplePortfolioFrame />
          <p className="mt-4 text-center text-xs text-[var(--faint-foreground)]">
            Real output from this product — one of three portfolio templates.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 text-center">
          <h2 className="t-h1">Your career, ready to share.</h2>
          <p className="t-lead mt-3 mx-auto max-w-lg">
            Start with your CV. Leave with a profile, a resume and a link worth sending.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
            <Link to={primaryTo} className="btn btn-primary w-full sm:w-auto">
              {primaryLabel}
            </Link>
            {auth.status !== 'authenticated' && (
              <Link to="/login" className="btn btn-ghost w-full sm:w-auto">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

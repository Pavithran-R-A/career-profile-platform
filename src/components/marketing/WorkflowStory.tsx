import { DEMO_PROFILE } from '../../lib/demo/fixture';
import { Reveal } from './Reveal';

function CvPreview() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'var(--accent)' }}>
          PDF
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--ink)] truncate">amara-cv.pdf</p>
          <p className="text-xs text-[var(--faint-foreground)]">PDF · up to 6 MiB</p>
        </div>
      </div>
      <div className="mt-3.5 space-y-2" aria-hidden="true">
        {[0.9, 0.7, 0.8].map((w, i) => (
          <span
            key={i}
            className="block h-2 rounded bg-[var(--surface-muted)]"
            style={{ width: `${w * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function ProfilePreview() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ background: 'var(--ink)' }}>
          {(DEMO_PROFILE.display_name ?? '')
            .split(' ')
            .map((p) => p[0])
            .join('')}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--ink)] truncate">
            {DEMO_PROFILE.display_name}
          </p>
          <p className="text-xs text-[var(--faint-foreground)] truncate">{DEMO_PROFILE.headline}</p>
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
        {[
          ['Roles', DEMO_PROFILE.experiences.length],
          ['Projects', DEMO_PROFILE.projects.length],
          ['Skills', DEMO_PROFILE.skills.length],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-lg bg-[var(--surface-warm)] py-2">
            <p className="text-[15px] font-bold text-[var(--ink)]">{v}</p>
            <p className="text-[11px] text-[var(--faint-foreground)]">{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AtsPreview() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--ink)]">ATS resume</p>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: 'var(--success-surface)', color: 'var(--success)' }}>
          Parseable
        </span>
      </div>
      <div className="mt-3.5 space-y-2" aria-hidden="true">
        {[0.95, 0.8, 0.85].map((w, i) => (
          <span
            key={i}
            className="block h-2 rounded bg-[var(--surface-muted)]"
            style={{ width: `${w * 100}%` }}
          />
        ))}
      </div>
      <p className="mt-3.5 text-[11px] uppercase tracking-widest font-semibold text-[var(--faint-foreground)]">
        Experience · Education · Skills
      </p>
    </div>
  );
}

function OutputPreview() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'var(--teal)' }}>
          ✓
        </span>
        <p className="text-sm font-semibold text-[var(--ink)]">Job match + portfolio</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {DEMO_PROFILE.skills.slice(0, 3).map((s) => (
          <span
            key={s.id}
            className="text-xs px-2 py-0.5 rounded-full border"
            style={{ borderColor: 'var(--border)', color: 'var(--teal-text)' }}>
            {s.name}
          </span>
        ))}
      </div>
      <div
        className="mt-3 rounded-lg px-3 py-2 text-xs font-mono text-white truncate"
        style={{ background: 'var(--navy-surface)' }}>
        /u/{DEMO_PROFILE.username}
      </div>
    </div>
  );
}

const STEPS = [
  {
    key: 'cv',
    label: 'Your CV',
    body: 'Start from the PDF you already have.',
    preview: <CvPreview />,
  },
  {
    key: 'profile',
    label: 'Career profile',
    body: 'Structured experience, projects and skills.',
    preview: <ProfilePreview />,
  },
  {
    key: 'ats',
    label: 'ATS resume',
    body: 'A clean, parseable resume you can export.',
    preview: <AtsPreview />,
  },
  {
    key: 'outputs',
    label: 'Job match + portfolio',
    body: 'Tailor to a role and publish your link.',
    preview: <OutputPreview />,
  },
] as const;

/**
 * Balanced 4-step workflow.
 * Desktop: flex row, four equal cards with slim arrow separators.
 * Tablet: 2x2 grid. Mobile: single column. No interleaved grid tracks.
 */
export function WorkflowStory() {
  return (
    <section
      id="features"
      className="scroll-mt-20 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <Reveal className="max-w-3xl">
          <p className="t-eyebrow">One source of career truth</p>
          <h2 className="t-display-section mt-4">One workflow. Multiple outputs.</h2>
          <p className="t-lead mt-5">
            Import once. Everything you publish — profile, resume, tailoring — comes from the same
            record, so it all stays consistent.
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:flex lg:items-stretch lg:gap-3">
            {STEPS.map((step, i) => (
              <li key={step.key} className="min-w-0 lg:flex-1 lg:basis-0">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-warm)] p-4 h-full flex flex-col">
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <span
                      aria-hidden="true"
                      className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center"
                      style={{ background: 'var(--ink)' }}>
                      {i + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--ink)]">
                      {step.label}
                    </span>
                  </div>
                  <div>{step.preview}</div>
                  <p className="mt-3.5 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

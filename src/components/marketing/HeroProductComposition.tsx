import { DEMO_PROFILE } from '../../lib/demo/fixture';
import { TemplateCanvas } from '../portfolio/TemplateCanvas';
import { BrowserFrame } from './BrowserFrame';

/** Miniature ATS resume card — in-flow, gentle rotation only. */
function ATSMiniSheet() {
  return (
    <div
      className="rounded-lg bg-white border border-[var(--border)] shadow-[var(--shadow-pop)] p-4 text-left"
      style={{ transform: 'rotate(-1.5deg)' }}
      aria-hidden="true">
      <p className="text-[13px] font-bold text-[var(--ink)] tracking-tight">
        {DEMO_PROFILE.display_name}
      </p>
      <p className="text-[11px] text-[var(--faint-foreground)]">Software Engineer · ATS resume</p>
      <div className="mt-2.5 space-y-1.5">
        {[0.9, 0.75, 0.85].map((w, i) => (
          <span
            key={i}
            className="block h-1.5 rounded bg-gray-200"
            style={{ width: `${w * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint-foreground)]">
          Experience
        </span>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--teal-text)' }}>
          parseable ✓
        </span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {[0.95, 0.8].map((w, i) => (
          <span
            key={i}
            className="block h-1.5 rounded bg-gray-200"
            style={{ width: `${w * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function JobMatchCard() {
  const matched = ['TypeScript', 'Kafka', 'Postgres'];
  const skills = DEMO_PROFILE.skills.slice(0, 3).map((s) => s.name);
  return (
    <div
      className="rounded-lg bg-white border border-[var(--border)] shadow-[var(--shadow-pop)] p-4 text-left"
      style={{ transform: 'rotate(1.5deg)' }}
      aria-hidden="true">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--accent-text)' }}>
          Job match
        </span>
        <span className="text-[10px] text-[var(--faint-foreground)]">Data Platform role</span>
      </div>
      <p className="text-[13px] font-semibold text-[var(--ink)] mt-2">Matched from your profile</p>
      <ul className="mt-1.5 space-y-1">
        {matched.map((m) => (
          <li key={m} className="flex items-center gap-2 text-xs text-[var(--foreground)]">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'var(--teal)' }}>
              ✓
            </span>
            {m}
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span
            key={s}
            className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Hero product composition — strict normal flow:
 * one main portfolio window, then two supporting cards side by side.
 * No absolute layers, so nothing can escape this block.
 */
export function HeroProductComposition() {
  return (
    <div aria-label="Product preview" className="space-y-4">
      <div className="rise rise-1">
        <BrowserFrame url={`/u/${DEMO_PROFILE.username}`}>
          <TemplateCanvas
            templateKey="minimal"
            profile={DEMO_PROFILE}
            preferences={{ accentKey: 'blue', sectionOrder: [], hiddenSections: [] }}
            scale={0.62}
            height={330}
            label="Example portfolio rendered with the Minimal template"
          />
        </BrowserFrame>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rise rise-3">
          <ATSMiniSheet />
        </div>
        <div className="rise rise-4">
          <JobMatchCard />
        </div>
      </div>

      <div className="rise rise-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {DEMO_PROFILE.skills.slice(0, 3).map((s) => (
            <span
              key={s.id}
              className="text-xs font-medium px-3 py-1 rounded-full bg-white border border-[var(--border)] shadow-[var(--shadow-card)] text-[var(--foreground)]">
              {s.name}
            </span>
          ))}
        </div>
        <p
          className="text-[13px] italic"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-text)' }}
          aria-hidden="true">
          one profile, everywhere
        </p>
      </div>

      <p className="sr-only">
        A composition showing a live portfolio, an ATS resume and a job-match analysis built from
        the same profile.
      </p>
    </div>
  );
}

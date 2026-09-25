import { Link } from 'react-router';
import { DEMO_PROFILE } from '../../lib/demo/fixture';
import { TemplateCanvas } from '../portfolio/TemplateCanvas';
import { BrowserFrame } from './BrowserFrame';

/** Layered product composition: real portfolio + ATS sheet + job match card. */
function ATSMiniSheet() {
  return (
    <div
      className="rounded-lg bg-white border border-[var(--border)] shadow-[var(--shadow-pop)] p-4 w-[224px] text-left"
      style={{ transform: 'rotate(-2.5deg)' }}
      aria-hidden="true">
      <p className="text-[11px] font-bold text-[var(--ink)] tracking-tight">
        {DEMO_PROFILE.display_name}
      </p>
      <p className="text-[9px] text-[var(--faint-foreground)]">Software Engineer · ATS resume</p>
      <div className="mt-2.5 space-y-1.5">
        {[0.9, 0.75, 0.85, 0.6, 0.7].map((w, i) => (
          <span
            key={i}
            className="block h-1 rounded bg-gray-200"
            style={{ width: `${w * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--faint-foreground)]">
          Experience
        </span>
        <span className="text-[9px] font-semibold text-[var(--teal-text)]">parseable ✓</span>
      </div>
      <div className="mt-1 space-y-1">
        {[0.95, 0.8, 0.7].map((w, i) => (
          <span
            key={i}
            className="block h-1 rounded bg-gray-200"
            style={{ width: `${w * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function JobMatchCard() {
  const matched = ['TypeScript', 'Kafka', 'Postgres'];
  const skills = DEMO_PROFILE.skills.slice(0, 4).map((s) => s.name);
  return (
    <div
      className="rounded-lg bg-white border border-[var(--border)] shadow-[var(--shadow-pop)] p-4 w-[236px] text-left"
      style={{ transform: 'rotate(2deg)' }}
      aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
          Job match
        </span>
        <span className="text-[9px] text-[var(--faint-foreground)]">Data Platform role</span>
      </div>
      <p className="text-[11px] font-semibold text-[var(--ink)] mt-2">Matched from your profile</p>
      <ul className="mt-1.5 space-y-1">
        {matched.map((m) => (
          <li key={m} className="flex items-center gap-1.5 text-[10px] text-[var(--foreground)]">
            <span
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
              style={{ background: 'var(--teal)' }}>
              ✓
            </span>
            {m}
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {skills.map((s) => (
          <span
            key={s}
            className="text-[9px] px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Hand-drawn-style annotation (SVG), restrained. */
function Annotation({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={`hidden xl:flex items-center gap-1.5 text-[13px] italic ${className ?? ''}`}
      style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-text)' }}
      aria-hidden="true">
      <svg width="34" height="16" viewBox="0 0 34 16" fill="none">
        <path
          d="M33 3C22 1 10 4 2 13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="2 3"
        />
        <path
          d="M2 13l6-2M2 13l3 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {text}
    </span>
  );
}

export function HeroProductComposition() {
  return (
    <div className="relative" aria-label="Product preview">
      {/* soft navy plinth */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-4 sm:-inset-x-6 top-10 bottom-10 rounded-[28px] -z-10"
        style={{ background: 'linear-gradient(160deg, #0b1628 0%, #132240 100%)' }}
      />

      {/* main portfolio browser card */}
      <div className="rise rise-1">
        <BrowserFrame url={`/u/${DEMO_PROFILE.username}`}>
          <TemplateCanvas
            templateKey="minimal"
            profile={DEMO_PROFILE}
            preferences={{ accentKey: 'blue', sectionOrder: [], hiddenSections: [] }}
            scale={0.58}
            height={340}
            label="Example portfolio rendered with the Minimal template"
          />
        </BrowserFrame>
      </div>

      {/* rotated ATS sheet */}
      <div className="rise rise-3 absolute -bottom-8 -left-4 sm:-left-10 hidden sm:block">
        <ATSMiniSheet />
      </div>

      {/* job match card */}
      <div className="rise rise-4 absolute -top-7 -right-3 sm:-right-8 hidden sm:block">
        <JobMatchCard />
      </div>

      {/* annotations */}
      <div className="absolute -top-10 left-4 rise rise-4">
        <Annotation text="one profile, everywhere" />
      </div>
      <div className="absolute -bottom-12 right-6 rise rise-4 hidden lg:flex">
        <Annotation text="ATS-ready" className="scale-x-[-1]" />
        <span className="sr-only">ATS-ready</span>
      </div>

      {/* floating skill chips */}
      <div className="rise rise-2 absolute -bottom-4 right-4 hidden md:flex gap-2">
        {DEMO_PROFILE.skills.slice(0, 3).map((s) => (
          <span
            key={s.id}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-white border border-[var(--border)] shadow-[var(--shadow-card)] text-[var(--foreground)]">
            {s.name}
          </span>
        ))}
      </div>

      <p className="sr-only">
        A layered composition showing a live portfolio, an ATS resume and a job-match analysis built
        from the same profile.
      </p>
      <Link to="/signup" className="sr-only">
        Create your profile
      </Link>
    </div>
  );
}

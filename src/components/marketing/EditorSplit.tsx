import { DEMO_PROFILE } from '../../lib/demo/fixture';
import { TemplateCanvas } from '../portfolio/TemplateCanvas';
import { Reveal } from './Reveal';

const NAV_ITEMS = ['Basics', 'Experience', 'Education', 'Projects', 'Skills', 'Links'];

/** Decorative editor mock showing how records are edited (real editor lives at /dashboard/profile). */
function EditorMock() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-pop)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-warm)]">
        <p className="text-sm font-semibold text-[var(--ink)]">Edit profile</p>
        <span className="text-[11px] text-[var(--faint-foreground)]">Experience</span>
      </div>
      <div className="grid grid-cols-[104px_1fr] sm:grid-cols-[140px_1fr] min-h-[340px]">
        <nav
          className="border-r border-[var(--border)] p-2.5 space-y-1 bg-[var(--surface-warm)]"
          aria-hidden="true">
          {NAV_ITEMS.map((item) => (
            <span
              key={item}
              className={`block text-[12px] rounded-md px-2.5 py-2 ${
                item === 'Experience'
                  ? 'bg-[var(--ink)] text-white font-semibold'
                  : 'text-[var(--muted-foreground)]'
              }`}>
              {item}
            </span>
          ))}
        </nav>
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
            Experience
          </p>
          {/* entry being edited */}
          <div className="rounded-xl border-2 p-3.5" style={{ borderColor: 'var(--accent)' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {DEMO_PROFILE.experiences[0].role}
                </p>
                <p className="text-[13px]" style={{ color: 'var(--accent-text)' }}>
                  {DEMO_PROFILE.experiences[0].company}
                </p>
                <p className="text-[11px] text-[var(--faint-foreground)] mt-0.5">
                  Mar 2022 – Present · Berlin
                </p>
              </div>
              <span
                className="text-[11px] font-semibold px-2 py-1 rounded-md border"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                Editing
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
              {['Month', 'Year', 'Month'].map((ph, i) => (
                <span
                  key={i}
                  className="text-[11px] text-[var(--faint-foreground)] border border-[var(--border)] rounded-md px-2 py-1.5 bg-white">
                  {ph}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <span
                className="text-[11px] font-semibold px-3 py-1.5 rounded-md text-white"
                style={{ background: 'var(--ink)' }}>
                Save
              </span>
              <span className="text-[11px] px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--muted-foreground)]">
                Cancel
              </span>
            </div>
          </div>
          {/* second record */}
          <div className="rounded-xl border border-[var(--border)] p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {DEMO_PROFILE.experiences[1].role}
                </p>
                <p className="text-[13px] text-[var(--muted-foreground)]">
                  {DEMO_PROFILE.experiences[1].company}
                </p>
              </div>
              <span className="text-[11px] text-[var(--faint-foreground)]">Edit ⋯</span>
            </div>
          </div>
          <span className="inline-block text-[12px] font-semibold px-3 py-2 rounded-md border border-dashed border-[var(--border-strong)] text-[var(--muted-foreground)]">
            + Add experience
          </span>
        </div>
      </div>
    </div>
  );
}

export function EditorSplit() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <Reveal className="max-w-3xl">
          <p className="t-eyebrow">One source of truth</p>
          <h2 className="t-display-section mt-4">A simpler career editor.</h2>
          <p className="t-lead mt-5">
            Update a role, a project or a skill once — your public portfolio, your ATS resume and
            every tailored output pick it up. Edit here, recruiters see it there.
          </p>
        </Reveal>

        <Reveal className="mt-12 grid grid-cols-1 lg:grid-cols-[1.05fr_auto_1fr] gap-6 lg:gap-4 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)] mb-3">
              Edit here
            </p>
            <EditorMock />
          </div>

          <div
            className="flex lg:flex-col items-center justify-center gap-2 py-2"
            aria-hidden="true">
            <span
              className="hidden lg:block w-px h-16"
              style={{
                background:
                  'repeating-linear-gradient(to bottom, var(--border-strong) 0 6px, transparent 6px 12px)',
              }}
            />
            <span className="lg:rotate-90 text-[var(--accent-text)] font-semibold text-sm whitespace-nowrap flex items-center gap-2">
              <svg width="34" height="10" viewBox="0 0 34 10" fill="none">
                <path
                  d="M0 5h28m0 0-5-4m5 4-5 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              updates everywhere
            </span>
            <span
              className="hidden lg:block w-px h-16"
              style={{
                background:
                  'repeating-linear-gradient(to bottom, var(--border-strong) 0 6px, transparent 6px 12px)',
              }}
            />
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)] mb-3">
              Recruiters see this
            </p>
            <div className="rounded-2xl overflow-hidden border border-[var(--border)] shadow-[var(--shadow-pop)]">
              <TemplateCanvas
                templateKey="minimal"
                profile={DEMO_PROFILE}
                preferences={{ accentKey: 'blue', sectionOrder: [], hiddenSections: [] }}
                scale={0.62}
                height={380}
                label="Live portfolio output updated by the editor"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

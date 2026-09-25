import { DEMO_PROFILE } from '../../lib/demo/fixture';
import { sanitizeUrl } from '../../lib/validators/url';
import { Reveal } from './Reveal';

const CALLOUTS = [
  { id: '1', label: 'Experience', target: 'experience' },
  { id: '2', label: 'Selected work', target: 'projects' },
  { id: '3', label: 'Skills', target: 'skills' },
  { id: '4', label: 'Links', target: 'links' },
] as const;

/** Recruiter-facing profile demo: familiar sections, scannable hierarchy. */
function RecruiterCard() {
  const exp = DEMO_PROFILE.experiences.slice(0, 2);
  const project = DEMO_PROFILE.projects[0];
  const skills = DEMO_PROFILE.skills.slice(0, 8);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-pop)] p-6 sm:p-8">
      <header className="pb-5 border-b border-[var(--border)]">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: 'var(--accent-text)' }}>
          {DEMO_PROFILE.headline}
        </p>
        <h3 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
          {DEMO_PROFILE.display_name}
        </h3>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{DEMO_PROFILE.location}</p>
      </header>

      <section className="pt-5" data-callout="experience">
        <div className="flex items-center gap-2">
          <span className="callout-dot">1</span>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
            Experience
          </h4>
        </div>
        <div className="mt-3 space-y-4">
          {exp.map((e) => (
            <div key={e.id} className="grid grid-cols-[1fr_auto] gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--ink)]">{e.role}</p>
                <p className="text-[13px] font-medium" style={{ color: 'var(--accent-text)' }}>
                  {e.company}
                </p>
                <p className="text-[13px] text-[var(--muted-foreground)] mt-1 leading-relaxed line-clamp-2">
                  {e.description}
                </p>
              </div>
              <span className="text-[11px] text-[var(--faint-foreground)] whitespace-nowrap pt-0.5">
                {e.start_year}–{e.is_current ? 'now' : e.end_year}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="pt-5 mt-5 border-t border-[var(--border)]" data-callout="projects">
        <div className="flex items-center gap-2">
          <span className="callout-dot">2</span>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
            Selected work
          </h4>
        </div>
        <div className="mt-3 rounded-xl border border-[var(--border)] p-4 bg-[var(--surface-warm)]">
          <p className="text-sm font-semibold text-[var(--ink)]">{project.name}</p>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
            {project.description}
          </p>
        </div>
      </section>

      <section className="pt-5 mt-5 border-t border-[var(--border)]" data-callout="skills">
        <div className="flex items-center gap-2">
          <span className="callout-dot">3</span>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
            Skills
          </h4>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {skills.map((s) => (
            <span key={s.id} className="chip">
              {s.name}
            </span>
          ))}
        </div>
      </section>

      <section className="pt-5 mt-5 border-t border-[var(--border)]" data-callout="links">
        <div className="flex items-center gap-2">
          <span className="callout-dot">4</span>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--faint-foreground)]">
            Links
          </h4>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {DEMO_PROFILE.links.map((l) => (
            <a
              key={l.id}
              href={sanitizeUrl(l.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium link-underline"
              style={{ color: 'var(--accent-text)' }}>
              {l.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

export function RecruiterSection() {
  return (
    <section id="for-recruiters" className="scroll-mt-20 border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-start">
          <Reveal>
            <p className="t-eyebrow">For recruiters</p>
            <h2 className="t-display-section mt-4">Built to be scanned, not deciphered.</h2>
            <p className="t-lead mt-5">
              The sections a recruiter expects, in the order they expect them — with the detail that
              backs it up one layer down.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                [
                  'Familiar structure',
                  'Experience, selected work, skills and links in a predictable reading order.',
                ],
                [
                  'Plain language first',
                  'Headlines and summaries say what you do; details wait below the fold.',
                ],
                [
                  'Claims you can check',
                  'Portfolio links point at real work — projects, source code and profiles.',
                ],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: 'var(--teal)' }}>
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
                    <p className="text-sm text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-2" aria-label="Profile sections">
              {CALLOUTS.map((c) => (
                <span key={c.id} className="chip">
                  <span
                    className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center mr-1.5"
                    style={{ background: 'var(--ink)' }}>
                    {c.id}
                  </span>
                  {c.label}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal>
            <RecruiterCard />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

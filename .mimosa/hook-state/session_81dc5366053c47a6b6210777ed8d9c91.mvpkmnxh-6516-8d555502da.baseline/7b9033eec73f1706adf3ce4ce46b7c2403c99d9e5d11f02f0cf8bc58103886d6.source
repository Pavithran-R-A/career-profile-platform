import { Link } from 'react-router';
import { Reveal } from './Reveal';

const JOB_SNIPPET = [
  'Senior Backend Engineer',
  'Payments & data platforms team',
  '· Kafka streaming',
  '· PostgreSQL at scale',
  '· TypeScript / Node.js',
  '· On-call ownership',
];

const EVIDENCE = [
  { label: 'Northwind Data — streaming pipelines', kind: 'experience' as const, matched: true },
  { label: '4B events/day, schema contracts', kind: 'impact' as const, matched: true },
  { label: 'Kafka · PostgreSQL · TypeScript', kind: 'skills' as const, matched: true },
];

const INCLUSIONS = [
  ['Experience', '3 roles', true],
  ['Education', '1 entry', true],
  ['Skills', '12 selected', true],
  ['Projects', '3 selected', true],
  ['Certifications', 'none added', false],
] as const;

function Panel({
  step,
  title,
  children,
  className = '',
}: {
  step: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-white p-5 ${className}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <span
          aria-hidden="true"
          className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
          style={{ background: 'var(--ink)' }}>
          {step}
        </span>
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--ink)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FlowArrow({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center text-[var(--faint-foreground)] ${vertical ? 'py-1' : 'px-1'}`}>
      <svg
        width={vertical ? 12 : 34}
        height={vertical ? 34 : 12}
        viewBox={vertical ? '0 0 12 34' : '0 0 34 12'}
        fill="none">
        {vertical ? (
          <>
            <path
              d="M6 0v28m0 0-4-5m4 5 4-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path
            d="M0 6h28m0 0-5-4m5 4-5 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}

export function CareerTools() {
  return (
    <section
      id="career-tools"
      className="scroll-mt-20 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <Reveal className="max-w-3xl">
          <p className="t-eyebrow">ATS resume + job tailoring</p>
          <h2 className="t-display-section mt-4">From job description to tailored resume.</h2>
          <p className="t-lead mt-5">
            Paste the role, see which of your real experiences and skills line up, choose what goes
            into the resume — then export a clean ATS PDF. We select the most relevant truth from
            your profile; we never invent one.
          </p>
        </Reveal>

        <Reveal className="mt-12 hidden md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-stretch">
          <Panel step="1" title="Job">
            <div className="rounded-xl bg-[var(--surface-warm)] border border-[var(--border)] p-3.5 font-mono text-[12px] leading-relaxed text-[var(--muted-foreground)]">
              {JOB_SNIPPET.map((line, i) => (
                <p
                  key={i}
                  className={i === 0 ? 'font-bold text-[var(--ink)] text-[13px] mb-1' : ''}>
                  {line}
                </p>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-[var(--faint-foreground)]">
              Paste any description — nothing leaves your account.
            </p>
          </Panel>

          <FlowArrow />

          <Panel step="2" title="Profile evidence">
            <ul className="space-y-2.5">
              {EVIDENCE.map((e) => (
                <li key={e.label} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: 'var(--teal)' }}>
                    ✓
                  </span>
                  <span className="text-[13px] text-[var(--foreground)] leading-snug">
                    {e.label}
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-2.5 pt-1">
                <span
                  aria-hidden="true"
                  className="mt-0.5 w-4.5 h-4.5 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--faint-foreground)' }}>
                  ?
                </span>
                <span className="text-[13px] text-[var(--faint-foreground)] leading-snug">
                  Certifications — not in your profile yet
                </span>
              </li>
            </ul>
            <p className="mt-3 text-[12px] text-[var(--faint-foreground)]">
              Matched evidence, relevant skills and honest gaps — side by side.
            </p>
          </Panel>

          <FlowArrow />

          <Panel step="3" title="Tailored output">
            <ul className="space-y-2">
              {INCLUSIONS.map(([label, meta, on]) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
                  <span className="text-[13px] font-medium text-[var(--ink)]">{label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--faint-foreground)]">{meta}</span>
                    <span
                      aria-hidden="true"
                      className={`w-8 h-4.5 rounded-full relative ${on ? '' : 'bg-gray-300'}`}
                      style={on ? { background: 'var(--teal)' } : undefined}>
                      <span
                        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow ${on ? 'right-0.5' : 'left-0.5'}`}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Link
              to="/dashboard/resume/ats"
              className="btn btn-primary btn-block mt-4 !min-h-[40px] !py-2 text-sm">
              Open ATS builder
            </Link>
          </Panel>
        </Reveal>

        {/* Mobile / tablet vertical flow */}
        <Reveal className="mt-10 md:hidden space-y-3">
          <Panel step="1" title="Job">
            <div className="rounded-xl bg-[var(--surface-warm)] border border-[var(--border)] p-3.5 font-mono text-[12px] leading-relaxed text-[var(--muted-foreground)]">
              {JOB_SNIPPET.slice(0, 4).map((line, i) => (
                <p
                  key={i}
                  className={i === 0 ? 'font-bold text-[var(--ink)] text-[13px] mb-1' : ''}>
                  {line}
                </p>
              ))}
            </div>
          </Panel>
          <FlowArrow vertical />
          <Panel step="2" title="Profile evidence">
            <ul className="space-y-2.5">
              {EVIDENCE.map((e) => (
                <li key={e.label} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: 'var(--teal)' }}>
                    ✓
                  </span>
                  <span className="text-[13px] text-[var(--foreground)] leading-snug">
                    {e.label}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <FlowArrow vertical />
          <Panel step="3" title="Tailored output">
            <p className="text-[13px] text-[var(--muted-foreground)]">
              Choose which sections go into your ATS-ready resume, then export.
            </p>
            <Link
              to="/dashboard/resume/ats"
              className="btn btn-primary btn-block mt-4 !min-h-[44px] text-sm">
              Open ATS builder
            </Link>
          </Panel>
        </Reveal>
      </div>
    </section>
  );
}

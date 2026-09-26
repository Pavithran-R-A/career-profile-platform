import { useState } from 'react';
import { DEMO_PROFILE } from '../../lib/demo/fixture';
import { ensureTemplatesRegistered } from '../../lib/templates/registry';
import { TemplateCanvas } from '../portfolio/TemplateCanvas';
import { BrowserFrame } from './BrowserFrame';
import { Reveal } from './Reveal';

const TABS = [
  { id: 'minimal', name: 'Minimal', note: 'Editorial, typography-led' },
  { id: 'editorial', name: 'Editorial', note: 'Serif, magazine-inspired' },
  { id: 'technical', name: 'Technical', note: 'Deep navy, developer-first' },
] as const;

/**
 * ONE controlled showcase viewport in normal flow.
 * Fixed height so switching templates never shifts page layout,
 * and nothing can escape into the next section.
 */
export function TemplateShowcase() {
  ensureTemplatesRegistered();
  const [active, setActive] = useState<string>('minimal');
  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <section id="templates" className="scroll-mt-20 border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <Reveal className="max-w-3xl">
          <p className="t-eyebrow">Three real templates</p>
          <h2 className="t-display-section mt-4">A style for every career story.</h2>
          <p className="t-lead mt-5">
            Switch templates any time — your content stays, the presentation changes. Everything
            below is rendered live by this product, not a screenshot.
          </p>
        </Reveal>

        {/* Tabs */}
        <Reveal className="mt-9">
          <div
            className="flex flex-wrap gap-2 p-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] w-fit"
            role="tablist"
            aria-label="Portfolio templates">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active === tab.id}
                aria-pressed={active === tab.id}
                onClick={() => setActive(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  active === tab.id
                    ? 'bg-[var(--ink)] text-white shadow-[var(--shadow-card)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)]'
                }`}>
                {tab.name}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Single bounded viewport — fixed height across all templates */}
        <Reveal className="mt-6">
          <div className="mx-auto max-w-4xl">
            <BrowserFrame url={`/u/${DEMO_PROFILE.username}`}>
              <TemplateCanvas
                key={active}
                templateKey={active}
                profile={DEMO_PROFILE}
                preferences={{ accentKey: 'blue', sectionOrder: [], hiddenSections: [] }}
                scale={0.7}
                height={440}
                label={`Live ${activeTab.name} template preview`}
              />
            </BrowserFrame>
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="text-sm text-[var(--muted-foreground)]">
                <span className="font-semibold text-[var(--ink)]">{activeTab.name}</span> —{' '}
                {activeTab.note}
              </p>
              <p className="text-xs text-[var(--faint-foreground)]">
                Demo profile rendered with the real template engine
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

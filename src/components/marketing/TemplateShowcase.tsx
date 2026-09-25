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

export function TemplateShowcase() {
  ensureTemplatesRegistered();
  const [active, setActive] = useState<string>('minimal');
  const inactive = TABS.filter((t) => t.id !== active);
  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <section id="templates" className="scroll-mt-20 border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <Reveal className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="t-eyebrow">Three real templates</p>
            <h2 className="t-display-section mt-4">A style for every career story.</h2>
            <p className="t-lead mt-5">
              Switch templates any time — your content stays, the presentation changes. Everything
              below is rendered live by this product, not a screenshot.
            </p>
          </div>
          <div
            className="flex gap-2 p-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] self-start"
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

        <Reveal className="mt-10 relative">
          {/* back layers: the other two templates */}
          <div
            className="hidden lg:block absolute inset-x-8 top-8 bottom-8 flex gap-6 opacity-60"
            aria-hidden="true">
            {inactive.map((tab, i) => (
              <div
                key={tab.id}
                className="flex-1 rounded-xl overflow-hidden border border-[var(--border)] shadow-[var(--shadow-card)]"
                style={{ transform: `rotate(${i === 0 ? -1.6 : 1.6}deg) translateY(10px)` }}>
                <TemplateCanvas
                  templateKey={tab.id}
                  profile={DEMO_PROFILE}
                  preferences={{ accentKey: 'blue', sectionOrder: [], hiddenSections: [] }}
                  scale={0.5}
                  height={360}
                  label={`${tab.name} template`}
                />
              </div>
            ))}
          </div>

          {/* front: active template */}
          <div className="relative mx-auto max-w-3xl lg:mx-0 lg:max-w-[54%] transition-transform duration-300">
            <BrowserFrame url={`/u/${DEMO_PROFILE.username}`}>
              <TemplateCanvas
                key={active}
                templateKey={active}
                profile={DEMO_PROFILE}
                preferences={{ accentKey: 'blue', sectionOrder: [], hiddenSections: [] }}
                scale={0.66}
                height={430}
                label={`Live ${activeTab.name} template preview`}
              />
            </BrowserFrame>
          </div>
        </Reveal>

        <Reveal className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--ink)]">{activeTab.name}</span> —{' '}
            {activeTab.note}
          </p>
          <p className="text-xs text-[var(--faint-foreground)]">
            Demo profile rendered with the real template engine
          </p>
        </Reveal>
      </div>
    </section>
  );
}

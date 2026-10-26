import TemplateSelector from './TemplateSelector';

const ACCENT_PRESETS: Record<string, { label: string; color: string }> = {
  blue: { label: 'Blue', color: '#2563eb' },
  indigo: { label: 'Indigo', color: '#4f46e5' },
  violet: { label: 'Violet', color: '#7c3aed' },
  emerald: { label: 'Emerald', color: '#059669' },
  teal: { label: 'Teal', color: '#0d9488' },
  amber: { label: 'Amber', color: '#d97706' },
  rose: { label: 'Rose', color: '#e11d48' },
  slate: { label: 'Slate', color: '#475569' },
};

const SECTION_LABELS: Record<string, string> = {
  about: 'About / Intro',
  basics: 'About / Intro',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  links: 'Links',
};

interface AppearanceControlsProps {
  draft: {
    template_key: string;
    accent_key: string;
    section_order: string[];
    hidden_sections: string[];
  };
  onTemplate: (key: string) => void;
  onAccent: (key: string) => void;
  onMoveSection: (index: number, direction: -1 | 1) => void;
  onSectionHidden: (section: string, hidden: boolean) => void;
}

/**
 * Pure presentation over the canonical appearance draft: every interaction
 * emits a synchronous draft mutation. No local persistence, no per-section
 * save buttons — the editor owns saving and the preview renders from draft.
 */
export default function AppearanceControls({
  draft,
  onTemplate,
  onAccent,
  onMoveSection,
  onSectionHidden,
}: AppearanceControlsProps) {
  const hiddenSet = new Set(draft.hidden_sections);

  return (
    <div className="space-y-8">
      <section>
        <TemplateSelector selectedId={draft.template_key} onSelect={onTemplate} />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm font-semibold text-[var(--ink)]">Accent color</span>
          <span className="text-xs text-[var(--faint-foreground)]">
            Applied across the template
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Accent color">
          {Object.entries(ACCENT_PRESETS).map(([key, { label, color }]) => {
            const isActive = draft.accent_key === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onAccent(key)}
                aria-pressed={isActive}
                title={label}
                className={`group flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  isActive
                    ? 'border-[var(--ink)] scale-110'
                    : 'border-transparent hover:border-[var(--border-strong)]'
                }`}
                style={{ backgroundColor: color }}>
                <span className="sr-only">{label}</span>
                {isActive && (
                  <svg
                    className="w-4 h-4 text-white drop-shadow"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--faint-foreground)] mt-2" aria-hidden="true">
          {ACCENT_PRESETS[draft.accent_key]?.label ?? 'Blue'}
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm font-semibold text-[var(--ink)]">Sections</span>
          <span className="text-xs text-[var(--faint-foreground)]">Order &amp; visibility</span>
        </div>
        <ul className="space-y-1.5" aria-label="Section order and visibility">
          {draft.section_order.map((section, idx) => {
            const label = SECTION_LABELS[section] ?? section;
            const isHidden = hiddenSet.has(section);
            return (
              <li
                key={section}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors ${
                  isHidden
                    ? 'border-[var(--border)] bg-[var(--surface-muted)] opacity-70'
                    : 'border-[var(--border)] bg-white'
                }`}>
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => onMoveSection(idx, -1)}
                    disabled={idx === 0}
                    aria-label={`Move ${label} up`}
                    className="w-6 h-4.5 rounded text-[var(--faint-foreground)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-25 disabled:pointer-events-none leading-none">
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveSection(idx, 1)}
                    disabled={idx === draft.section_order.length - 1}
                    aria-label={`Move ${label} down`}
                    className="w-6 h-4.5 rounded text-[var(--faint-foreground)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-25 disabled:pointer-events-none leading-none">
                    ▼
                  </button>
                </div>
                <span
                  className={`flex-1 text-sm min-w-0 truncate ${
                    isHidden ? 'text-[var(--faint-foreground)] line-through' : 'text-[var(--ink)]'
                  }`}>
                  {label}
                </span>
                <button
                  type="button"
                  onClick={() => onSectionHidden(section, !isHidden)}
                  aria-pressed={!isHidden}
                  aria-label={`${isHidden ? 'Show' : 'Hide'} ${label}`}
                  title={isHidden ? `Show ${label}` : `Hide ${label}`}
                  className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    isHidden
                      ? 'text-[var(--faint-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]'
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]'
                  }`}>
                  {isHidden ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.6 10.7a2.4 2.4 0 003.3 3.3M7 7.2C4.7 8.6 3 10.8 2.2 12c1.7 2.9 5.2 6 9.8 6 1.6 0 3-.4 4.3-1m-2.2-9.4A9.6 9.6 0 0121.8 12c-.5.9-1.3 2-2.5 3"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M2.2 12C3.9 8.9 7.5 6 12 6s8.1 2.9 9.8 6c-1.7 3.1-5.3 6-9.8 6s-8.1-2.9-9.8-6z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

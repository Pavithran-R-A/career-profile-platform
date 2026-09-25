import { useState } from 'react';
import { getAllTemplates, type Template } from '../lib/templates/types';

interface TemplateSelectorProps {
  selectedId: string;
  onSelect: (templateId: string) => void;
}

/** Mini layout mock for each template — communicates structure, not a fake screenshot. */
function TemplateThumb({ id }: { id: string }) {
  const line = (w: string, dark = false) => (
    <span
      key={w}
      className={`block h-1.5 rounded-full ${dark ? 'bg-white/25' : 'bg-gray-300'}`}
      style={{ width: w }}
    />
  );

  if (id === 'editorial') {
    return (
      <div className="w-full h-24 rounded-md overflow-hidden flex border border-gray-200 bg-[#faf6ee]">
        <div className="w-1/3 h-full bg-[#7c3aed]/10 border-r border-gray-200 p-2 space-y-1.5">
          <span className="block h-2 w-8 rounded bg-[#7c3aed]/60" />
          <span className="block h-1.5 w-10 rounded bg-gray-300" />
          <span className="block h-1.5 w-8 rounded bg-gray-300" />
        </div>
        <div className="flex-1 p-2 space-y-1.5">
          <span className="block h-1.5 w-16 rounded bg-gray-400" />
          {line('100%')}
          {line('80%')}
          <span className="block h-1.5 w-12 rounded bg-[#7c3aed]/50" />
          {line('90%')}
        </div>
      </div>
    );
  }

  if (id === 'technical') {
    return (
      <div className="w-full h-24 rounded-md p-2 space-y-1.5 bg-[#0f172a] border border-[#0f172a]">
        <span className="block h-2 w-14 rounded bg-[#2dd4bf]/80" />
        <span className="block h-1.5 w-20 rounded bg-white/25" />
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <span className="block h-8 rounded border border-white/15 bg-white/5" />
          <span className="block h-8 rounded border border-white/15 bg-white/5" />
        </div>
        <span className="block h-1.5 w-24 rounded bg-white/20" />
      </div>
    );
  }

  // minimal
  return (
    <div className="w-full h-24 rounded-md p-2 space-y-1.5 bg-white border border-gray-200">
      <span className="block h-2.5 w-16 rounded bg-gray-800" />
      <span className="block h-1.5 w-10 rounded bg-[#2563eb]/70" />
      <span className="block h-px w-full bg-gray-200" />
      <div className="flex gap-1.5">
        <span className="block h-1.5 w-10 rounded bg-gray-300" />
        <span className="flex-1 space-y-1">
          {line('100%')}
          {line('70%')}
        </span>
      </div>
      <div className="flex gap-1">
        <span className="block h-3 w-8 rounded-full bg-gray-100" />
        <span className="block h-3 w-10 rounded-full bg-gray-100" />
        <span className="block h-3 w-9 rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

export default function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  const [templates] = useState<Template[]>(() => getAllTemplates());

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--ink)]">Template</span>
        <span className="text-xs text-[var(--faint-foreground)]">
          Preview updates as you choose
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {templates.map((tpl) => {
          const isActive = tpl.metadata.id === selectedId;

          return (
            <button
              key={tpl.metadata.id}
              type="button"
              onClick={() => onSelect(tpl.metadata.id)}
              aria-pressed={isActive}
              className={`relative rounded-xl border-2 p-3.5 text-left transition-all ${
                isActive
                  ? 'border-[var(--ink)] bg-white shadow-[var(--shadow-card)]'
                  : 'border-[var(--border)] bg-white hover:border-[var(--border-strong)]'
              }`}>
              {isActive && (
                <span className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-[var(--ink)] flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
              )}

              <TemplateThumb id={tpl.metadata.id} />

              <p className="text-sm font-semibold text-[var(--ink)] mt-3">{tpl.metadata.name}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-snug">
                {tpl.metadata.description}
              </p>
            </button>
          );
        })}

        {templates.length === 0 && (
          <p className="col-span-3 text-sm text-[var(--muted-foreground)] text-center py-8">
            No templates available.
          </p>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { getAllTemplates, type Template } from '../lib/templates/types';

interface TemplateSelectorProps {
  selectedId: string;
  onSelect: (templateId: string) => void;
}

const TEMPLATE_THUMBNAILS: Record<string, string> = {
  minimal: 'Clean, lightweight single-column layout',
  editorial: 'Two-column sidebar layout for editorial feel',
  technical: 'Monospace terminal-style layout',
};

export default function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  const [templates] = useState<Template[]>(() => getAllTemplates());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">Template</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {templates.map((tpl) => {
          const isActive = tpl.metadata.id === selectedId;
          const isHovered = tpl.metadata.id === hoveredId;

          return (
            <button
              key={tpl.metadata.id}
              type="button"
              onClick={() => onSelect(tpl.metadata.id)}
              onMouseEnter={() => setHoveredId(tpl.metadata.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                isActive
                  ? 'border-gray-900 bg-gray-50'
                  : isHovered
                    ? 'border-gray-300 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
              }`}>
              {isActive && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-gray-900 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
              )}

              <div
                className="w-full h-20 rounded mb-3 flex items-center justify-center text-xs"
                style={{
                  backgroundColor: tpl.config.colors.background,
                  color: tpl.config.colors.text,
                  border: `1px solid ${tpl.config.colors.muted}30`,
                }}>
                {tpl.metadata.name}
              </div>

              <p className="text-sm font-medium text-gray-900">{tpl.metadata.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {TEMPLATE_THUMBNAILS[tpl.metadata.id] ?? tpl.metadata.description}
              </p>

              {tpl.metadata.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tpl.metadata.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}

        {templates.length === 0 && (
          <p className="col-span-3 text-sm text-gray-500 text-center py-8">
            No templates available.
          </p>
        )}
      </div>
    </div>
  );
}

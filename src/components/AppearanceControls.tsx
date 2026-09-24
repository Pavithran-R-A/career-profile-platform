import { useState, useCallback } from 'react';
import TemplateSelector from './TemplateSelector';
import {
  type ProfilePreferences,
  updateTemplate,
  updateAccent,
  updateSectionOrder,
  updateHiddenSections,
} from '../lib/profiles/preferences';

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
  profileId: string;
  preferences: ProfilePreferences;
  onChange?: (prefs: ProfilePreferences) => void;
}

export default function AppearanceControls({
  profileId,
  preferences,
  onChange,
}: AppearanceControlsProps) {
  const [templateKey, setTemplateKey] = useState(preferences.template_key);
  const [accentKey, setAccentKey] = useState(preferences.accent_key);
  const [sectionOrder, setSectionOrder] = useState<string[]>(preferences.section_order);
  const [hidden, setHidden] = useState(new Set(preferences.hidden_sections));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emitChange = useCallback(
    (overrides: Partial<ProfilePreferences>) => {
      onChange?.({
        ...preferences,
        ...overrides,
      });
    },
    [onChange, preferences]
  );

  const handleTemplateSelect = useCallback(
    async (id: string) => {
      setTemplateKey(id);
      setError(null);
      setSaving(true);
      const { error: err } = await updateTemplate(profileId, id);
      setSaving(false);
      if (err) {
        setError(err);
        return;
      }
      emitChange({ template_key: id });
    },
    [emitChange, profileId]
  );

  const handleAccentSelect = useCallback(
    async (key: string) => {
      setAccentKey(key);
      setError(null);
      setSaving(true);
      const { error: err } = await updateAccent(profileId, key);
      setSaving(false);
      if (err) {
        setError(err);
        return;
      }
      emitChange({ accent_key: key });
    },
    [emitChange, profileId]
  );

  const toggleSection = useCallback((section: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const saveVisibility = useCallback(async () => {
    const arr = Array.from(hidden);
    setError(null);
    setSaving(true);
    const { error: err } = await updateHiddenSections(profileId, arr);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    emitChange({ hidden_sections: arr });
  }, [emitChange, hidden, profileId]);

  const moveSection = useCallback((index: number, direction: -1 | 1) => {
    setSectionOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const saveOrder = useCallback(async () => {
    setError(null);
    setSaving(true);
    const { error: err } = await updateSectionOrder(profileId, sectionOrder);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    emitChange({ section_order: sectionOrder });
  }, [emitChange, profileId, sectionOrder]);

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <section>
        <TemplateSelector
          selectedId={templateKey}
          onSelect={(id) => void handleTemplateSelect(id)}
        />
      </section>

      <section>
        <label className="block text-sm font-medium text-gray-700 mb-3">Accent Color</label>
        <div className="flex flex-wrap gap-3">
          {Object.entries(ACCENT_PRESETS).map(([key, { label, color }]) => (
            <button
              key={key}
              type="button"
              onClick={() => void handleAccentSelect(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                accentKey === key
                  ? 'border-gray-900 bg-gray-50 font-medium'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
              <span
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700">
            Section Order &amp; Visibility
          </label>
          <button
            type="button"
            onClick={() => void saveOrder()}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
            Save order
          </button>
        </div>
        <div className="space-y-1">
          {sectionOrder.map((section, idx) => (
            <div
              key={section}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveSection(idx, -1)}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                  aria-label="Move up">
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, 1)}
                  disabled={idx === sectionOrder.length - 1}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                  aria-label="Move down">
                  ▼
                </button>
              </div>
              <span className="flex-1 text-sm">{SECTION_LABELS[section] ?? section}</span>
              <button
                type="button"
                onClick={() => toggleSection(section)}
                className={`text-xs px-2 py-1 rounded ${
                  hidden.has(section) ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-700'
                }`}>
                {hidden.has(section) ? 'Hidden' : 'Visible'}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void saveVisibility()}
          disabled={saving}
          className="mt-3 text-sm px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
          Save visibility
        </button>
      </section>
    </div>
  );
}

/**
 * Canonical Appearance draft state.
 *
 * One source of truth for the Appearance editor: every control (template,
 * accent, section order, visibility) mutates this draft synchronously and the
 * live preview renders straight from it — before any persistence round trip.
 *
 * `appearanceDraft` = { saved, current }
 *   - saved:   the server state at last successful load/save
 *   - current: what the user sees and edits right now
 * `dirty` = saved !== current. On save the draft persists `current` as a
 * whole (one upsert, all fields), so per-control save buttons and implicit
 * save rules are gone, and a failed save can never clobber the other
 * preference fields (the previous per-field upserts did exactly that).
 */

import { upsertPreferences, type ProfilePreferences } from './preferences';

export interface AppearanceDraft {
  saved: ProfilePreferences;
  current: ProfilePreferences;
}

export type AppearanceSaveStatus =
  | 'idle' // nothing changed yet
  | 'saving' // persistence in flight
  | 'saved' // last change persisted
  | 'error'; // persistence failed; draft kept intact

export interface AppearanceState extends AppearanceDraft {
  status: AppearanceSaveStatus;
  dirty: boolean;
}

const VALID_SECTIONS = [
  'basics',
  'experience',
  'education',
  'projects',
  'skills',
  'links',
] as const;
const VALID_ACCENTS = [
  'blue',
  'indigo',
  'violet',
  'emerald',
  'teal',
  'amber',
  'rose',
  'slate',
] as const;
const VALID_TEMPLATES = ['minimal', 'editorial', 'technical'] as const;

const DEFAULTS: Omit<ProfilePreferences, 'id' | 'profile_id'> = {
  template_key: 'minimal',
  accent_key: 'blue',
  section_order: ['basics', 'experience', 'education', 'projects', 'skills', 'links'],
  hidden_sections: [],
};

function clampToValid(prefs: ProfilePreferences): ProfilePreferences {
  const template = (VALID_TEMPLATES as readonly string[]).includes(prefs.template_key)
    ? prefs.template_key
    : DEFAULTS.template_key;
  const accent = (VALID_ACCENTS as readonly string[]).includes(prefs.accent_key)
    ? prefs.accent_key
    : DEFAULTS.accent_key;

  const storedOrder = Array.isArray(prefs.section_order) ? prefs.section_order : [];
  // Preserve the user's order for known sections, then append any known
  // section the stored order is missing (schema default used "about").
  const order: string[] = [];
  for (const section of storedOrder) {
    if ((VALID_SECTIONS as readonly string[]).includes(section) && !order.includes(section)) {
      order.push(section);
    }
  }
  for (const section of VALID_SECTIONS) {
    if (!order.includes(section)) order.push(section);
  }

  const hidden = Array.isArray(prefs.hidden_sections)
    ? prefs.hidden_sections.filter((s): s is (typeof VALID_SECTIONS)[number] =>
        (VALID_SECTIONS as readonly string[]).includes(s)
      )
    : [];

  return {
    ...prefs,
    template_key: template,
    accent_key: accent,
    section_order: order,
    hidden_sections: hidden,
  };
}

/** Normalized initial state from the server row (or defaults for a new profile). */
export function initialAppearanceState(server: ProfilePreferences | null): AppearanceState {
  const clean = clampToValid(
    server ?? ({ id: '', profile_id: '', ...DEFAULTS } as ProfilePreferences)
  );
  return { saved: clean, current: clean, status: 'idle', dirty: false };
}

function withCurrent(state: AppearanceState, current: ProfilePreferences): AppearanceState {
  return {
    ...state,
    current,
    dirty:
      current.template_key !== state.saved.template_key ||
      current.accent_key !== state.saved.accent_key ||
      current.section_order.join('|') !== state.saved.section_order.join('|') ||
      current.hidden_sections.join('|') !== state.saved.hidden_sections.join('|'),
  };
}

export function setTemplate(state: AppearanceState, templateKey: string): AppearanceState {
  return withCurrent(state, { ...state.current, template_key: templateKey });
}

export function setAccent(state: AppearanceState, accentKey: string): AppearanceState {
  return withCurrent(state, { ...state.current, accent_key: accentKey });
}

export function moveSection(
  state: AppearanceState,
  index: number,
  direction: -1 | 1
): AppearanceState {
  const order = [...state.current.section_order];
  const target = index + direction;
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) return state;
  [order[index], order[target]] = [order[target], order[index]];
  return withCurrent(state, { ...state.current, section_order: order });
}

export function setSectionHidden(
  state: AppearanceState,
  section: string,
  hidden: boolean
): AppearanceState {
  const set = new Set(state.current.hidden_sections);
  if (hidden) set.add(section);
  else set.delete(section);
  return withCurrent(state, { ...state.current, hidden_sections: Array.from(set) });
}

/** Undo everything back to the last saved server state. */
export function resetToSaved(state: AppearanceState): AppearanceState {
  return {
    ...state,
    current: state.saved,
    status: state.dirty ? state.status : state.status,
    dirty: false,
  };
}

/**
 * Persist the whole draft with one upsert. Optimistic: the caller keeps
 * rendering `current` regardless; on failure the draft stays editable and
 * `status: 'error'` lets the UI offer a retry.
 */
export async function saveAppearance(state: AppearanceState): Promise<AppearanceState> {
  const saving: AppearanceState = { ...state, status: 'saving' };
  const { error } = await upsertPreferences(state.current.profile_id, {
    template_key: state.current.template_key,
    accent_key: state.current.accent_key,
    section_order: state.current.section_order,
    hidden_sections: state.current.hidden_sections,
  });

  if (error) return { ...saving, status: 'error' };
  return { ...saving, saved: state.current, status: 'saved', dirty: false };
}

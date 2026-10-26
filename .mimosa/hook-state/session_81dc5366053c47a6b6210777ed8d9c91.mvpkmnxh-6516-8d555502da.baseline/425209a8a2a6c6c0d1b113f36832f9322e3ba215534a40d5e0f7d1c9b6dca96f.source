import { describe, it, expect, vi } from 'vitest';
import {
  initialAppearanceState,
  setTemplate,
  setAccent,
  moveSection,
  setSectionHidden,
  resetToSaved,
  saveAppearance,
  mergeAppearanceSaveResult,
} from '../../lib/profiles/appearance-draft';
import type { ProfilePreferences } from '../../lib/profiles/preferences';

/**
 * The supabase client is mocked at the boundary; every appearance save goes
 * through `from('profile_preferences').upsert(...).onConflict('profile_id')`.
 * We capture the upsert payloads so tests can assert exactly what persists.
 */
const upsertCalls: Array<Record<string, unknown>> = [];
let upsertShouldFail = false;

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (_table: string) => ({
      upsert: (payload: Record<string, unknown>) => {
        upsertCalls.push(payload);
        return Promise.resolve({
          error: upsertShouldFail ? new Error('network down') : null,
        });
      },
    }),
  }),
}));

const UUID = '550e8400-e29b-41d4-a716-446655440000';

function makePrefs(overrides: Partial<ProfilePreferences> = {}): ProfilePreferences {
  return {
    id: 'prefs-1',
    profile_id: UUID,
    template_key: 'minimal',
    accent_key: 'blue',
    section_order: ['basics', 'experience', 'education', 'projects', 'skills', 'links'],
    hidden_sections: [],
    ...overrides,
  };
}

function resetPersistenceMock() {
  upsertCalls.length = 0;
  upsertShouldFail = false;
}

describe('appearance draft state', () => {
  it('starts clean from saved server state', () => {
    const state = initialAppearanceState(makePrefs());
    expect(state.dirty).toBe(false);
    expect(state.status).toBe('idle');
    expect(state.current.template_key).toBe('minimal');
  });

  it('falls back to defaults when no server row exists (default template truthfully renders)', () => {
    const state = initialAppearanceState(null);
    expect(state.current).toEqual(
      expect.objectContaining({ template_key: 'minimal', accent_key: 'blue' })
    );
    expect(state.dirty).toBe(false);
  });

  it('new profiles with no preferences retain their real ID for the first save', async () => {
    resetPersistenceMock();
    const initial = initialAppearanceState(null, UUID);
    expect(initial.current.profile_id).toBe(UUID);
    const edited = setAccent(initial, 'emerald');
    const saved = await saveAppearance(edited);
    expect(saved.status).toBe('saved');
    expect(upsertCalls[0].profile_id).toBe(UUID);
    expect(upsertCalls[0].accent_key).toBe('emerald');
  });

  it('normalizes legacy section orders: unknown keys dropped, all six known sections kept', () => {
    const state = initialAppearanceState(
      makePrefs({ section_order: ['about', 'skills', 'projects'] })
    );
    // legacy "about" position is kept, remaining known sections appended once
    expect(state.current.section_order.slice(0, 3)).toEqual(['skills', 'projects', 'basics']);
    expect(new Set(state.current.section_order).size).toBe(6);
  });

  it('rejects unknown template/accent keys by clamping to defaults', () => {
    const state = initialAppearanceState(
      makePrefs({ template_key: 'unknown', accent_key: 'nope' })
    );
    expect(state.current.template_key).toBe('minimal');
    expect(state.current.accent_key).toBe('blue');
  });

  it('template selection updates draft instantly and marks dirty BEFORE persistence', () => {
    let state = initialAppearanceState(makePrefs());
    resetPersistenceMock();
    state = setTemplate(state, 'technical');
    expect(state.current.template_key).toBe('technical');
    expect(state.dirty).toBe(true);
    expect(state.status).toBe('idle'); // no round trip has happened
    expect(upsertCalls).toHaveLength(0);
  });

  it('accent selection updates draft instantly and marks dirty', () => {
    let state = initialAppearanceState(makePrefs());
    state = setAccent(state, 'emerald');
    expect(state.current.accent_key).toBe('emerald');
    expect(state.dirty).toBe(true);
  });

  it('moving a section reorders the draft immediately', () => {
    let state = initialAppearanceState(makePrefs());
    const before = state.current.section_order.join('|');
    state = moveSection(state, 1, -1); // experience above basics
    const after = state.current.section_order.join('|');
    expect(after).not.toBe(before);
    expect(state.current.section_order[0]).toBe('experience');
    expect(state.dirty).toBe(true);
  });

  it('hiding a section adds it to hidden list; unhiding removes it', () => {
    let state = initialAppearanceState(makePrefs());
    state = setSectionHidden(state, 'projects', true);
    expect(state.current.hidden_sections).toContain('projects');
    state = setSectionHidden(state, 'projects', false);
    expect(state.current.hidden_sections).not.toContain('projects');
  });

  it('resetToSaved restores the saved snapshot and clears dirty', () => {
    let state = initialAppearanceState(makePrefs({ accent_key: 'rose' }));
    state = setTemplate(state, 'editorial');
    state = moveSection(state, 0, 1);
    expect(state.dirty).toBe(true);
    state = resetToSaved(state);
    expect(state.current).toEqual(state.saved);
    expect(state.current.template_key).toBe('minimal');
    expect(state.dirty).toBe(false);
  });

  it('save persists the WHOLE config in one upsert (no sibling-field clobbering)', async () => {
    resetPersistenceMock();
    let state = initialAppearanceState(
      makePrefs({
        template_key: 'technical',
        accent_key: 'emerald',
        section_order: ['skills', 'basics', 'experience', 'education', 'projects', 'links'],
        hidden_sections: ['education'],
      })
    );
    state = await saveAppearance(state);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toEqual({
      profile_id: UUID,
      template_key: 'technical',
      accent_key: 'emerald',
      section_order: ['skills', 'basics', 'experience', 'education', 'projects', 'links'],
      hidden_sections: ['education'],
    });
    expect(state.status).toBe('saved');
    expect(state.dirty).toBe(false);
    expect(state.saved).toEqual(state.current);
  });

  it('a failed save keeps the draft intact and flips status to error (retry path)', async () => {
    resetPersistenceMock();
    upsertShouldFail = true;
    let state = initialAppearanceState(makePrefs());
    state = setTemplate(state, 'editorial');
    state = await saveAppearance(state);
    expect(state.status).toBe('error');
    expect(state.dirty).toBe(true);
    expect(state.current.template_key).toBe('editorial'); // user still sees their choice
    expect(state.saved.template_key).toBe('minimal'); // server unchanged
  });
});

/**
 * REGRESSION TEST FOR THE REPORTED LIVE-PREVIEW BUG.
 *
 * The old implementation kept template/accent state inside AppearanceControls
 * and only called onChange AFTER a successful database round trip — so the
 * preview never rendered the draft, and a template save could reset the saved
 * section order to schema defaults. These tests fail on the old architecture:
 * they assert the draft updates synchronously and that persistence writes all
 * fields together.
 */
describe('regression: appearance live preview (draft-first architecture)', () => {
  it('preview state (draft) diverges from saved state immediately, with zero persistence calls', () => {
    resetPersistenceMock();

    let state = initialAppearanceState(makePrefs({ template_key: 'minimal' }));

    // Click Technical -> preview (draft) becomes technical BEFORE any save
    state = setTemplate(state, 'technical');
    expect(state.current.template_key).toBe('technical');
    expect(state.saved.template_key).toBe('minimal');
    expect(state.dirty).toBe(true);
    expect(upsertCalls).toHaveLength(0); // the whole point

    // Click Emerald -> accent draft updates instantly too
    state = setAccent(state, 'emerald');
    expect(state.current.accent_key).toBe('emerald');

    // Hide projects -> visible in hidden list instantly
    state = setSectionHidden(state, 'projects', true);
    expect(state.current.hidden_sections).toContain('projects');

    // Reorder repeatedly -> order stays synchronized in the draft
    state = moveSection(state, 0, 1);
    const afterFirstMove = state.current.section_order.join('|');
    state = moveSection(state, 1, 1);
    expect(state.current.section_order.join('|')).not.toBe(afterFirstMove);

    // Still zero persistence calls after every interaction
    expect(upsertCalls).toHaveLength(0);
  });

  it('keeps a newer unsaved draft when an earlier autosave completes', async () => {
    resetPersistenceMock();

    const initial = initialAppearanceState(makePrefs());
    const firstEdit = setTemplate(initial, 'technical');
    const newerEdit = setAccent(firstEdit, 'emerald');

    const result = await saveAppearance(firstEdit);
    const reconciled = mergeAppearanceSaveResult(newerEdit, result);

    expect(reconciled.saved.template_key).toBe('technical');
    expect(reconciled.saved.accent_key).toBe('blue');
    expect(reconciled.current.template_key).toBe('technical');
    expect(reconciled.current.accent_key).toBe('emerald');
    expect(reconciled.dirty).toBe(true);

    const finalResult = await saveAppearance(reconciled);
    const completed = mergeAppearanceSaveResult(reconciled, finalResult);
    expect(completed.current).toEqual(completed.saved);
    expect(completed.dirty).toBe(false);
  });

  it('a template-only save can no longer reset the saved section order', async () => {
    resetPersistenceMock();

    const state = initialAppearanceState(
      makePrefs({
        section_order: ['projects', 'skills', 'basics', 'experience', 'education', 'links'],
      })
    );
    const changed = setTemplate(state, 'editorial');
    await saveAppearance(changed);

    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].section_order).toEqual([
      'projects',
      'skills',
      'basics',
      'experience',
      'education',
      'links',
    ]);
    expect(upsertCalls[0].accent_key).toBe('blue'); // unchanged field is still written intact
  });
});

import { describe, it, expect } from 'vitest';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const VALID_TEMPLATE_KEYS = ['minimal', 'editorial', 'technical'];
const VALID_ACCENT_KEYS = ['blue', 'indigo', 'violet', 'emerald', 'teal', 'amber', 'rose', 'slate'];
const ALL_SECTIONS = ['about', 'experience', 'education', 'projects', 'skills', 'links'];

function makePreferences(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    profile_id: VALID_UUID,
    template_key: 'minimal',
    accent_key: 'blue',
    section_order: [...ALL_SECTIONS],
    hidden_sections: [],
    ...overrides,
  };
}

describe('Preferences validation', () => {
  describe('template key', () => {
    it('accepts valid template keys', () => {
      for (const key of VALID_TEMPLATE_KEYS) {
        const prefs = makePreferences({ template_key: key });
        expect(prefs.template_key).toBe(key);
      }
    });

    it('rejects unknown template key', () => {
      const prefs = makePreferences({ template_key: 'unknown' });
      expect(VALID_TEMPLATE_KEYS).not.toContain(prefs.template_key);
    });
  });

  describe('accent key', () => {
    it('accepts valid accent keys', () => {
      for (const key of VALID_ACCENT_KEYS) {
        const prefs = makePreferences({ accent_key: key });
        expect(prefs.accent_key).toBe(key);
      }
    });

    it('rejects unknown accent key', () => {
      const prefs = makePreferences({ accent_key: 'unknown' });
      expect(VALID_ACCENT_KEYS).not.toContain(prefs.accent_key);
    });
  });

  describe('section order', () => {
    it('accepts all valid sections in default order', () => {
      const prefs = makePreferences();
      expect(prefs.section_order).toEqual(ALL_SECTIONS);
    });

    it('accepts custom section order with all valid sections', () => {
      const prefs = makePreferences({
        section_order: ['skills', 'about', 'links', 'projects', 'education', 'experience'],
      });
      expect(prefs.section_order).toHaveLength(ALL_SECTIONS.length);
    });

    it('rejects section order with unknown section', () => {
      const prefs = makePreferences({ section_order: ['about', 'unknown'] });
      expect(prefs.section_order).toContain('unknown');
    });

    it('rejects section order with duplicates', () => {
      const prefs = makePreferences({ section_order: ['about', 'about'] });
      expect(prefs.section_order.filter((s: string) => s === 'about')).toHaveLength(2);
    });

    it('rejects empty section order', () => {
      const prefs = makePreferences({ section_order: [] });
      expect(prefs.section_order).toHaveLength(0);
    });
  });

  describe('hidden sections', () => {
    it('allows empty hidden sections', () => {
      const prefs = makePreferences({ hidden_sections: [] });
      expect(prefs.hidden_sections).toHaveLength(0);
    });

    it('allows hiding a single section', () => {
      const prefs = makePreferences({ hidden_sections: ['skills'] });
      expect(prefs.hidden_sections).toContain('skills');
    });

    it('allows hiding all sections', () => {
      const prefs = makePreferences({ hidden_sections: [...ALL_SECTIONS] });
      expect(prefs.hidden_sections).toHaveLength(ALL_SECTIONS.length);
    });

    it('allows hiding multiple sections', () => {
      const prefs = makePreferences({ hidden_sections: ['education', 'skills'] });
      expect(prefs.hidden_sections).toContain('education');
      expect(prefs.hidden_sections).toContain('skills');
    });
  });

  describe('defaults', () => {
    it('has correct defaults', () => {
      const prefs = makePreferences();
      expect(prefs.template_key).toBe('minimal');
      expect(prefs.accent_key).toBe('blue');
      expect(prefs.section_order).toEqual(ALL_SECTIONS);
      expect(prefs.hidden_sections).toEqual([]);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { profileSchema } from '../../lib/profiles/schemas';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeMinimalProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    userId: VALID_UUID,
    identity: { fullName: 'Alice', headline: 'Engineer', location: null, avatarUrl: null },
    about: null,
    experiences: [],
    education: [],
    projects: [],
    skills: [],
    links: [],
    preferences: { username: 'alice', visibility: 'draft' as const, showEmail: false },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('Publishing logic', () => {
  describe('visibility state transitions', () => {
    it("allows draft -> published", () => {
      const profile = makeMinimalProfile();
      Object.assign(profile.preferences, { visibility: "published" });
      expect(() => profileSchema.parse(profile)).not.toThrow();
      expect(profile.preferences.visibility).toBe("published");
    });

    it('allows published -> draft', () => {
      const profile = makeMinimalProfile({
        preferences: { username: 'alice', visibility: 'published', showEmail: false },
      });
      profile.preferences = { ...profile.preferences, visibility: 'draft' };
      expect(() => profileSchema.parse(profile)).not.toThrow();
      expect(profile.preferences.visibility).toBe('draft');
    });

    it('rejects an invalid visibility value', () => {
      const profile = makeMinimalProfile();
      profile.preferences = { ...profile.preferences, visibility: 'archived' as never };
      expect(() => profileSchema.parse(profile)).toThrow();
    });
  });

  describe('profile completeness', () => {
    it('requires at least a display name', () => {
      const profile = makeMinimalProfile({
        identity: { fullName: '', headline: '', location: null, avatarUrl: null },
      });
      expect(() => profileSchema.parse(profile)).toThrow();
    });

    it('allows minimal profile with just name', () => {
      const profile = makeMinimalProfile();
      expect(() => profileSchema.parse(profile)).not.toThrow();
    });

    it('accepts profile with experience', () => {
      const profile = makeMinimalProfile({
        experiences: [
          {
            id: VALID_UUID,
            role: 'Engineer',
            company: 'Acme',
            location: null,
            startDate: '2023-01-01',
            endDate: null,
            description: 'Built things',
          },
        ],
      });
      expect(() => profileSchema.parse(profile)).not.toThrow();
    });
  });

  describe('username validation', () => {
    it('requires valid username format', () => {
      const profile = makeMinimalProfile({
        preferences: { username: 'a', visibility: 'draft', showEmail: false },
      });
      expect(() => profileSchema.parse(profile)).toThrow();
    });

    it('accepts valid username', () => {
      const profile = makeMinimalProfile({
        preferences: { username: 'alice-smith', visibility: 'draft', showEmail: false },
      });
      expect(() => profileSchema.parse(profile)).not.toThrow();
    });
  });
});

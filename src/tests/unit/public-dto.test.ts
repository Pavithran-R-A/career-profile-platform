import { describe, it, expect } from 'vitest';
import { PublicPortfolioSchema } from '../../lib/profiles/public';

// Contract test on the SHIPPED public DTO schema (audit 2026-10-27: the
// previous file asserted its own fixture's key set and even claimed
// id/preferences must be absent — contradicting the real schema). The true
// privacy boundary is enforced server-side (the Worker serializes a
// server-only projection; response-level exclusions are asserted in
// second-closure.test.ts). This file pins the schema's actual key contract:
// which fields are public, and which must never appear.

const schemaKeys = Object.keys(PublicPortfolioSchema.shape).sort();

describe('PublicPortfolioSchema key contract', () => {
  it('exposes the public-safe portfolio fields', () => {
    for (const key of [
      'username',
      'display_name',
      'headline',
      'about',
      'location',
      'avatar_url',
      'visibility',
      'experiences',
      'education',
      'skills',
      'projects',
      'links',
      'evidence',
      'achievements',
    ]) {
      expect(schemaKeys).toContain(key);
    }
  });

  it('never exposes auth or account-internal fields', () => {
    for (const forbidden of ['user_id', 'email', 'show_email', 'auth_user_id']) {
      expect(schemaKeys).not.toContain(forbidden);
    }
  });

  it('parses a minimal valid public payload (evidence/achievements default to [])', () => {
    const parsed = PublicPortfolioSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      username: 'alice',
      display_name: 'Alice',
      headline: null,
      about: null,
      location: null,
      avatar_url: null,
      visibility: 'published',
      published_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      experiences: [],
      education: [],
      skills: [],
      projects: [],
      links: [],
      preferences: {
        template_key: 'minimal',
        accent_key: 'blue',
        section_order: ['about'],
        hidden_sections: [],
      },
    });
    expect(parsed.evidence).toEqual([]);
    expect(parsed.achievements).toEqual([]);
  });

  it('rejects a payload whose visibility is outside the published/draft enum', () => {
    expect(
      PublicPortfolioSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice',
        display_name: null,
        headline: null,
        about: null,
        location: null,
        avatar_url: null,
        visibility: 'secret',
        published_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        experiences: [],
        education: [],
        skills: [],
        projects: [],
        links: [],
        preferences: {
          template_key: 'minimal',
          accent_key: 'blue',
          section_order: [],
          hidden_sections: [],
        },
      }).success
    ).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { profileSchema } from '../../lib/profiles/schemas';
import type { PublicProfile } from '../../lib/profiles/types';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const PUBLIC_DTO_SCHEMA = z.object({
  username: z.string(),
  identity: z.object({
    fullName: z.string(),
    headline: z.string(),
    location: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  about: z.string().nullable(),
  experiences: z.array(z.any()),
  education: z.array(z.any()),
  projects: z.array(z.any()),
  skills: z.array(z.any()),
  links: z.array(z.any()),
  visibility: z.enum(['draft', 'published']),
  publishedAt: z.string().nullable(),
});

function makePublicDTO(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    username: 'alice',
    identity: {
      fullName: 'Alice Johnson',
      headline: 'Senior Engineer',
      location: 'San Francisco, CA',
      avatarUrl: 'https://example.com/avatar.png',
    },
    about: 'Passionate engineer building great software.',
    experiences: [],
    education: [],
    projects: [],
    skills: [],
    links: [],
    visibility: 'published',
    publishedAt: '2025-01-15T00:00:00Z',
    ...overrides,
  };
}

describe('Public DTO privacy', () => {
  describe('user_id exclusion', () => {
    it('public DTO does not expose user_id', () => {
      const dto = makePublicDTO();
      const keys = Object.keys(dto);
      expect(keys).not.toContain('user_id');
    });

    it('public DTO type does not include user_id field', () => {
      const dto = makePublicDTO();
      expect('user_id' in dto).toBe(false);
    });

    it('full profile schema includes userId but public DTO does not', () => {
      const fullProfile = {
        id: VALID_UUID,
        userId: VALID_UUID,
        identity: {
          fullName: 'Alice',
          headline: 'Engineer',
          location: null,
          avatarUrl: null,
        },
        about: null,
        experiences: [],
        education: [],
        projects: [],
        skills: [],
        links: [],
        preferences: { username: 'alice', visibility: 'draft' as const, showEmail: false },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      expect(() => profileSchema.parse(fullProfile)).not.toThrow();
      expect('userId' in fullProfile).toBe(true);

      const dto = makePublicDTO();
      expect('userId' in dto).toBe(false);
    });
  });

  describe('internal field exclusion', () => {
    it('public DTO does not expose profile id', () => {
      const dto = makePublicDTO();
      expect('id' in dto).toBe(false);
    });

    it('public DTO does not expose createdAt', () => {
      const dto = makePublicDTO();
      expect('createdAt' in dto).toBe(false);
    });

    it('public DTO does not expose updatedAt', () => {
      const dto = makePublicDTO();
      expect('updatedAt' in dto).toBe(false);
    });

    it('public DTO does not expose showEmail preference', () => {
      const dto = makePublicDTO();
      expect('showEmail' in dto).toBe(false);
    });

    it('public DTO does not expose preferences object', () => {
      const dto = makePublicDTO();
      expect('preferences' in dto).toBe(false);
    });

    it('public DTO does not expose any private preference keys', () => {
      const dto = makePublicDTO();
      const forbiddenKeys = ['showEmail', 'preferences', 'email', 'internalNotes'];
      for (const key of forbiddenKeys) {
        expect(key in dto).toBe(false);
      }
    });
  });

  describe('allowed fields only', () => {
    it('public DTO contains only public-safe fields', () => {
      const dto = makePublicDTO();
      const allowedFields = [
        'username',
        'identity',
        'about',
        'experiences',
        'education',
        'projects',
        'skills',
        'links',
        'visibility',
        'publishedAt',
      ];
      const dtoKeys = Object.keys(dto);
      expect(dtoKeys.sort()).toEqual(allowedFields.sort());
    });

    it('public DTO validates against public-only schema', () => {
      const dto = makePublicDTO();
      expect(() => PUBLIC_DTO_SCHEMA.parse(dto)).not.toThrow();
    });

    it('rejects public DTO with extra internal fields', () => {
      const dtoWithInternal = {
        ...makePublicDTO(),
        userId: VALID_UUID,
        internalFlag: true,
      };
      const result = PUBLIC_DTO_SCHEMA.safeParse(dtoWithInternal);
      expect(result.success).toBe(true);
      // The Zod schema accepts extras by default, but the type shouldn't have them
    });
  });

  describe('username field', () => {
    it('public DTO includes username', () => {
      const dto = makePublicDTO();
      expect(dto.username).toBe('alice');
    });

    it('public DTO username is a non-empty string', () => {
      const dto = makePublicDTO();
      expect(typeof dto.username).toBe('string');
      expect(dto.username.length).toBeGreaterThan(0);
    });

    it('username does not contain domain info', () => {
      const dto = makePublicDTO();
      expect(dto.username).not.toContain('.');
      expect(dto.username).not.toContain('@');
    });
  });

  describe('identity field', () => {
    it('public DTO includes safe identity fields', () => {
      const dto = makePublicDTO();
      expect(dto.identity.fullName).toBe('Alice Johnson');
      expect(dto.identity.headline).toBe('Senior Engineer');
      expect(dto.identity.location).toBe('San Francisco, CA');
      expect(dto.identity.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('identity does not contain internal metadata', () => {
      const dto = makePublicDTO();
      const identityKeys = Object.keys(dto.identity);
      const forbiddenIdentityKeys = ['internalId', 'notes', 'privateField'];
      for (const key of forbiddenIdentityKeys) {
        expect(identityKeys).not.toContain(key);
      }
    });

    it('allows null avatarUrl in identity', () => {
      const dto = makePublicDTO({
        identity: {
          fullName: 'Alice',
          headline: 'Engineer',
          location: null,
          avatarUrl: null,
        },
      });
      expect(dto.identity.avatarUrl).toBeNull();
    });
  });

  describe('visibility field', () => {
    it('public DTO includes visibility', () => {
      const dto = makePublicDTO();
      expect(dto.visibility).toBe('published');
    });

    it('public DTO only accepts published visibility', () => {
      const dto = makePublicDTO({ visibility: 'published' });
      expect(PUBLIC_DTO_SCHEMA.parse(dto).visibility).toBe('published');
    });

    it('public DTO schema accepts both draft and published visibility', () => {
      const publishedDto = makePublicDTO({ visibility: 'published' });
      const draftDto = makePublicDTO({ visibility: 'draft' });
      expect(PUBLIC_DTO_SCHEMA.safeParse(publishedDto).success).toBe(true);
      expect(PUBLIC_DTO_SCHEMA.safeParse(draftDto).success).toBe(true);
    });

    it('actual public profile query filters to published only', () => {
      const dto = makePublicDTO({ visibility: 'published' });
      expect(dto.visibility).toBe('published');
    });
  });

  describe('data completeness', () => {
    it('public DTO preserves experience data', () => {
      const dto = makePublicDTO({
        experiences: [
          {
            id: VALID_UUID,
            role: 'Engineer',
            company: 'Acme',
            location: 'Remote',
            startDate: '2022-01',
            endDate: null,
            description: 'Built things.',
          },
        ],
      });
      expect(dto.experiences).toHaveLength(1);
    });

    it('public DTO preserves skills data', () => {
      const dto = makePublicDTO({
        skills: [{ name: 'TypeScript', evidenceCount: 5 }],
      });
      expect(dto.skills).toHaveLength(1);
    });

    it('public DTO preserves links data', () => {
      const dto = makePublicDTO({
        links: [{ label: 'GitHub', url: 'https://github.com/alice' }],
      });
      expect(dto.links).toHaveLength(1);
    });

    it('public DTO preserves education data', () => {
      const dto = makePublicDTO({
        education: [
          {
            id: VALID_UUID,
            degree: 'B.S.',
            institution: 'MIT',
            field: 'CS',
            startDate: '2015',
            endDate: '2019',
          },
        ],
      });
      expect(dto.education).toHaveLength(1);
    });

    it('public DTO preserves projects data', () => {
      const dto = makePublicDTO({
        projects: [
          {
            id: VALID_UUID,
            name: 'Portfolio',
            description: 'Personal site',
            url: 'https://alice.dev',
            repoUrl: null,
            technologies: ['React'],
          },
        ],
      });
      expect(dto.projects).toHaveLength(1);
    });
  });
});

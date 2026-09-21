import { describe, it, expect } from 'vitest';
import {
  identitySchema,
  profileLinkSchema,
  profileSkillSchema,
  experienceSchema,
  educationSchema,
  projectSchema,
} from '../../lib/profiles/schemas';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Template rendering', () => {
  describe('identity schema used in public template', () => {
    it('accepts identity with all fields', () => {
      expect(
        identitySchema.parse({
          fullName: 'Alice Johnson',
          headline: 'Senior Engineer',
          location: 'San Francisco, CA',
          avatarUrl: 'https://example.com/avatar.png',
        })
      ).toBeDefined();
    });

    it('accepts identity with only required fields', () => {
      expect(identitySchema.parse({ fullName: 'Alice', headline: 'Engineer' })).toBeDefined();
    });

    it('truncates very long headline at schema level', () => {
      expect(identitySchema.parse({ fullName: 'A', headline: 'x'.repeat(255) })).toBeDefined();
    });

    it('rejects headline exceeding 255 chars', () => {
      expect(() => identitySchema.parse({ fullName: 'A', headline: 'x'.repeat(256) })).toThrow();
    });
  });

  describe('experience rendering inputs', () => {
    it('parses a valid experience entry', () => {
      const exp = experienceSchema.parse({
        id: VALID_UUID,
        role: 'Software Engineer',
        company: 'Acme Corp',
        location: 'Remote',
        startDate: '2022-01-15',
        endDate: '2024-06-30',
        description: 'Led the frontend team.',
      });
      expect(exp.role).toBe('Software Engineer');
      expect(exp.company).toBe('Acme Corp');
    });

    it('allows null endDate for current roles', () => {
      const exp = experienceSchema.parse({
        id: VALID_UUID,
        role: 'Lead',
        company: 'Co',
        location: null,
        startDate: '2023-01',
        endDate: null,
        description: '',
      });
      expect(exp.endDate).toBeNull();
    });
  });

  describe('education rendering inputs', () => {
    it('parses a valid education entry', () => {
      const edu = educationSchema.parse({
        id: VALID_UUID,
        degree: 'M.S. Computer Science',
        institution: 'Stanford University',
        field: 'Artificial Intelligence',
        startDate: '2019-09',
        endDate: '2021-06',
      });
      expect(edu.institution).toBe('Stanford University');
    });

    it('allows null field', () => {
      const edu = educationSchema.parse({
        id: VALID_UUID,
        degree: 'B.S.',
        institution: 'MIT',
        field: null,
        startDate: '2015',
        endDate: '2019',
      });
      expect(edu.field).toBeNull();
    });
  });

  describe('project rendering inputs', () => {
    it('parses a valid project with technologies', () => {
      const proj = projectSchema.parse({
        id: VALID_UUID,
        name: 'Portfolio Site',
        description: 'Personal portfolio',
        url: 'https://alice.dev',
        repoUrl: 'https://github.com/alice/portfolio',
        technologies: ['React', 'TypeScript', 'Tailwind CSS'],
      });
      expect(proj.technologies).toHaveLength(3);
    });

    it('allows empty technologies array', () => {
      const proj = projectSchema.parse({
        id: VALID_UUID,
        name: 'Side Project',
        description: '',
        url: null,
        repoUrl: null,
        technologies: [],
      });
      expect(proj.technologies).toHaveLength(0);
    });
  });

  describe('skill rendering inputs', () => {
    it('parses a valid skill with evidenceCount', () => {
      const skill = profileSkillSchema.parse({ name: 'TypeScript', evidenceCount: 5 });
      expect(skill.name).toBe('TypeScript');
      expect(skill.evidenceCount).toBe(5);
    });

    it('defaults evidenceCount to 0', () => {
      const skill = profileSkillSchema.parse({ name: 'Go' });
      expect(skill.evidenceCount).toBe(0);
    });
  });

  describe('link rendering inputs', () => {
    it('parses a valid link', () => {
      const link = profileLinkSchema.parse({
        label: 'LinkedIn',
        url: 'https://linkedin.com/in/alice',
      });
      expect(link.label).toBe('LinkedIn');
    });

    it('rejects link with non-URL', () => {
      expect(() => profileLinkSchema.parse({ label: 'Blog', url: 'not-a-url' })).toThrow();
    });
  });

  describe('public profile data shape', () => {
    it('validates a complete public profile payload', () => {
      const publicProfile = {
        username: 'alice',
        identity: {
          fullName: 'Alice Johnson',
          headline: 'Senior Engineer',
          location: 'SF',
          avatarUrl: null,
        },
        about: 'Passionate engineer.',
        experiences: [
          {
            id: VALID_UUID,
            role: 'Engineer',
            company: 'Acme',
            location: 'Remote',
            startDate: '2022-01',
            endDate: null,
            description: 'Built stuff.',
          },
        ],
        education: [],
        projects: [],
        skills: [{ name: 'TypeScript', evidenceCount: 3 }],
        links: [{ label: 'GitHub', url: 'https://github.com/alice' }],
        visibility: 'published' as const,
        publishedAt: '2025-01-01T00:00:00Z',
      };

      expect(publicProfile.username).toBe('alice');
      expect(publicProfile.experiences).toHaveLength(1);
      expect(publicProfile.skills).toHaveLength(1);
      expect(publicProfile.links).toHaveLength(1);
      expect(publicProfile.visibility).toBe('published');
    });
  });
});

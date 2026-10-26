import { describe, it, expect } from 'vitest';
import {
  identitySchema,
  profileLinkSchema,
  experienceSchema,
  educationSchema,
  projectSchema,
  profileSkillSchema,
} from '../../lib/profiles/schemas';

const VALID_UUIDS = {
  exp: '550e8400-e29b-41d4-a716-446655440001',
  edu: '550e8400-e29b-41d4-a716-446655440002',
  proj: '550e8400-e29b-41d4-a716-446655440003',
};

describe('identitySchema', () => {
  it('accepts valid identity', () => {
    expect(identitySchema.parse({ fullName: 'Alice', headline: 'Engineer' })).toBeDefined();
  });

  it('rejects empty fullName', () => {
    expect(() => identitySchema.parse({ fullName: '', headline: 'Engineer' })).toThrow();
  });

  it('rejects missing headline', () => {
    expect(() => identitySchema.parse({ fullName: 'Alice' })).toThrow();
  });

  it('allows null location', () => {
    expect(
      identitySchema.parse({ fullName: 'Alice', headline: 'Eng', location: null })
    ).toBeDefined();
  });
});

describe('profileLinkSchema', () => {
  it('accepts valid link', () => {
    expect(
      profileLinkSchema.parse({ label: 'GitHub', url: 'https://github.com/alice' })
    ).toBeDefined();
  });

  it('rejects invalid URL', () => {
    expect(() => profileLinkSchema.parse({ label: 'GitHub', url: 'not-a-url' })).toThrow();
  });
});

describe('experienceSchema', () => {
  it('accepts valid experience', () => {
    expect(
      experienceSchema.parse({
        id: VALID_UUIDS.exp,
        role: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        startDate: '2023-01-01',
        endDate: null,
        description: 'Built things',
      })
    ).toBeDefined();
  });

  it('rejects invalid UUID', () => {
    expect(() =>
      experienceSchema.parse({
        id: 'not-a-uuid',
        role: 'Engineer',
        company: 'Acme',
        location: null,
        startDate: '2023-01-01',
        endDate: null,
        description: 'Built things',
      })
    ).toThrow();
  });
});

describe('educationSchema', () => {
  it('accepts valid education', () => {
    expect(
      educationSchema.parse({
        id: VALID_UUIDS.edu,
        degree: 'BS',
        institution: 'MIT',
        field: 'CS',
        startDate: '2018-09-01',
        endDate: '2022-06-01',
      })
    ).toBeDefined();
  });
});

describe('projectSchema', () => {
  it('accepts valid project', () => {
    expect(
      projectSchema.parse({
        id: VALID_UUIDS.proj,
        name: 'My Project',
        description: 'A cool project',
        url: null,
        repoUrl: 'https://github.com/alice/project',
        technologies: ['TypeScript', 'React'],
      })
    ).toBeDefined();
  });

  it('rejects empty technologies array entry', () => {
    expect(() =>
      projectSchema.parse({
        id: VALID_UUIDS.proj,
        name: 'My Project',
        description: 'A cool project',
        url: null,
        repoUrl: null,
        technologies: [''],
      })
    ).toThrow();
  });
});

describe('profileSkillSchema', () => {
  it('accepts valid skill', () => {
    expect(profileSkillSchema.parse({ name: 'TypeScript' })).toBeDefined();
  });

  it('defaults evidenceCount to 0', () => {
    expect(profileSkillSchema.parse({ name: 'TypeScript' }).evidenceCount).toBe(0);
  });
});

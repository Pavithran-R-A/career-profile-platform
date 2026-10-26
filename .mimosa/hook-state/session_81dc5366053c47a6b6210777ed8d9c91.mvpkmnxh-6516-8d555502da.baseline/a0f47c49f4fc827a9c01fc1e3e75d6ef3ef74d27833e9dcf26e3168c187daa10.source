import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { safeUrlSchema, optionalSafeUrlSchema } from '../../lib/validators/url';

const monthSchema = z.number().int().min(1).max(12).nullable();
const yearSchema = z.number().int().min(1900).max(2100).nullable();

const experienceSchema = z.object({
  company: z.string().min(1).max(255),
  role: z.string().min(1).max(255),
  location: z.string().nullable(),
  startYear: yearSchema,
  startMonth: monthSchema,
  endYear: yearSchema,
  endMonth: monthSchema,
  isCurrent: z.boolean(),
  description: z.string().nullable(),
});

describe('Experience validation', () => {
  it('accepts valid experience', () => {
    expect(
      experienceSchema.parse({
        company: 'Acme Corp',
        role: 'Engineer',
        location: 'Remote',
        startYear: 2020,
        startMonth: 1,
        endYear: 2023,
        endMonth: 6,
        isCurrent: false,
        description: 'Built things',
      })
    ).toBeDefined();
  });

  it('accepts current position without end date', () => {
    expect(
      experienceSchema.parse({
        company: 'Acme Corp',
        role: 'Engineer',
        location: null,
        startYear: 2023,
        startMonth: 1,
        endYear: null,
        endMonth: null,
        isCurrent: true,
        description: null,
      })
    ).toBeDefined();
  });

  it('rejects invalid month', () => {
    expect(() =>
      experienceSchema.parse({
        company: 'Acme',
        role: 'Engineer',
        location: null,
        startYear: 2020,
        startMonth: 13,
        endYear: null,
        endMonth: null,
        isCurrent: true,
        description: null,
      })
    ).toThrow();
  });

  it('rejects invalid year', () => {
    expect(() =>
      experienceSchema.parse({
        company: 'Acme',
        role: 'Engineer',
        location: null,
        startYear: 1800,
        startMonth: 1,
        endYear: null,
        endMonth: null,
        isCurrent: true,
        description: null,
      })
    ).toThrow();
  });

  it('rejects empty company', () => {
    expect(() =>
      experienceSchema.parse({
        company: '',
        role: 'Engineer',
        location: null,
        startYear: 2020,
        startMonth: 1,
        endYear: null,
        endMonth: null,
        isCurrent: true,
        description: null,
      })
    ).toThrow();
  });

  it('rejects empty role', () => {
    expect(() =>
      experienceSchema.parse({
        company: 'Acme',
        role: '',
        location: null,
        startYear: 2020,
        startMonth: 1,
        endYear: null,
        endMonth: null,
        isCurrent: true,
        description: null,
      })
    ).toThrow();
  });
});

const projectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  projectUrl: optionalSafeUrlSchema,
  repositoryUrl: optionalSafeUrlSchema,
});

describe('Project URL validation', () => {
  it('accepts valid HTTPS URLs', () => {
    expect(
      projectSchema.parse({
        name: 'My Project',
        description: 'A cool project',
        projectUrl: 'https://example.com',
        repositoryUrl: 'https://github.com/user/repo',
      })
    ).toBeDefined();
  });

  it('accepts null URLs', () => {
    expect(
      projectSchema.parse({
        name: 'My Project',
        description: null,
        projectUrl: null,
        repositoryUrl: null,
      })
    ).toBeDefined();
  });

  it('rejects javascript: URLs', () => {
    expect(() =>
      projectSchema.parse({
        name: 'My Project',
        description: null,
        projectUrl: 'javascript:alert(1)',
        repositoryUrl: null,
      })
    ).toThrow();
  });

  it('rejects data: URLs', () => {
    expect(() =>
      projectSchema.parse({
        name: 'My Project',
        description: null,
        projectUrl: 'data:text/html,<script>alert(1)</script>',
        repositoryUrl: null,
      })
    ).toThrow();
  });

  it('rejects invalid URLs', () => {
    expect(() =>
      projectSchema.parse({
        name: 'My Project',
        description: null,
        projectUrl: 'not-a-url',
        repositoryUrl: null,
      })
    ).toThrow();
  });
});

const linkSchema = z.object({
  label: z.string().min(1).max(255),
  url: safeUrlSchema,
});

describe('Link URL validation', () => {
  it('accepts valid URLs', () => {
    expect(
      linkSchema.parse({ label: 'LinkedIn', url: 'https://linkedin.com/in/user' })
    ).toBeDefined();
  });

  it('rejects javascript: URLs', () => {
    expect(() => linkSchema.parse({ label: 'XSS', url: 'javascript:alert(1)' })).toThrow();
  });

  it('rejects empty label', () => {
    expect(() => linkSchema.parse({ label: '', url: 'https://example.com' })).toThrow();
  });
});

const educationSchema = z.object({
  institution: z.string().min(1).max(255),
  degree: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  startYear: yearSchema,
  startMonth: monthSchema,
  endYear: yearSchema,
  endMonth: monthSchema,
});

describe('Education validation', () => {
  it('accepts valid education', () => {
    expect(
      educationSchema.parse({
        institution: 'MIT',
        degree: 'BS',
        fieldOfStudy: 'CS',
        startYear: 2018,
        startMonth: 9,
        endYear: 2022,
        endMonth: 6,
      })
    ).toBeDefined();
  });

  it('accepts education with null dates', () => {
    expect(
      educationSchema.parse({
        institution: 'MIT',
        degree: null,
        fieldOfStudy: null,
        startYear: null,
        startMonth: null,
        endYear: null,
        endMonth: null,
      })
    ).toBeDefined();
  });

  it('rejects empty institution', () => {
    expect(() =>
      educationSchema.parse({
        institution: '',
        degree: 'BS',
        fieldOfStudy: 'CS',
        startYear: 2018,
        startMonth: 9,
        endYear: 2022,
        endMonth: 6,
      })
    ).toThrow();
  });
});

const profileBasicsSchema = z.object({
  displayName: z.string().min(1).max(255),
  headline: z.string().max(255),
  about: z.string().nullable(),
  location: z.string().nullable(),
});

describe('Profile basics validation', () => {
  it('accepts valid basics', () => {
    expect(
      profileBasicsSchema.parse({
        displayName: 'John Doe',
        headline: 'Software Engineer',
        about: 'I build things',
        location: 'San Francisco, CA',
      })
    ).toBeDefined();
  });

  it('accepts empty optional fields', () => {
    expect(
      profileBasicsSchema.parse({
        displayName: 'John Doe',
        headline: '',
        about: null,
        location: null,
      })
    ).toBeDefined();
  });

  it('rejects empty displayName', () => {
    expect(() =>
      profileBasicsSchema.parse({
        displayName: '',
        headline: 'Engineer',
        about: null,
        location: null,
      })
    ).toThrow();
  });
});

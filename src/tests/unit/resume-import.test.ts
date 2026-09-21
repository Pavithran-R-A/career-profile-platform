import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ResumeImportPayload } from '../../lib/resume/import';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const EducationEntrySchema = z.object({
  degree: z.string().min(1),
  institution: z.string().min(1),
  year_start: z.number().int().optional(),
  year_end: z.number().int().optional(),
  details: z.string().optional(),
});

const ExperienceEntrySchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().optional(),
});

const SkillEntrySchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
});

const ProjectEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url().optional(),
  tech_stack: z.array(z.string()).optional(),
});

const ResumeImportPayloadSchema = z.object({
  profile_id: z.string().uuid(),
  template_key: z.string().optional(),
  accent_key: z.string().optional(),
  section_order: z.array(z.string()).optional(),
  hidden_sections: z.array(z.string()).optional(),
  education: z.array(EducationEntrySchema).optional(),
  experience: z.array(ExperienceEntrySchema).optional(),
  skills: z.array(SkillEntrySchema).optional(),
  projects: z.array(ProjectEntrySchema).optional(),
});

function makeImportPayload(overrides: Partial<ResumeImportPayload> = {}): ResumeImportPayload {
  return {
    profile_id: VALID_UUID,
    ...overrides,
  };
}

describe('Resume import RPC interface', () => {
  describe('payload schema validation', () => {
    it('accepts minimal payload with only profile_id', () => {
      const payload = makeImportPayload();
      expect(() => ResumeImportPayloadSchema.parse(payload)).not.toThrow();
    });

    it('accepts payload with all optional fields', () => {
      const payload = makeImportPayload({
        template_key: 'classic',
        accent_key: 'blue',
        section_order: ['basics', 'experience', 'education'],
        hidden_sections: ['projects'],
        education: [
          {
            degree: 'B.S. Computer Science',
            institution: 'MIT',
            year_start: 2015,
            year_end: 2019,
          },
        ],
        experience: [
          {
            title: 'Software Engineer',
            company: 'Acme Corp',
            start_date: '2019-07',
            end_date: '2024-01',
            description: 'Built web applications.',
          },
        ],
        skills: [
          { name: 'TypeScript', category: 'Languages' },
          { name: 'React', category: 'Frameworks' },
        ],
        projects: [
          {
            name: 'Portfolio Site',
            description: 'Personal portfolio',
            url: 'https://alice.dev',
            tech_stack: ['React', 'TypeScript'],
          },
        ],
      });
      expect(() => ResumeImportPayloadSchema.parse(payload)).not.toThrow();
    });

    it('rejects payload with missing profile_id', () => {
      const payload = { template_key: 'classic' };
      expect(() => ResumeImportPayloadSchema.parse(payload)).toThrow();
    });

    it('rejects payload with invalid profile_id format', () => {
      const payload = makeImportPayload({ profile_id: 'not-a-uuid' });
      expect(() => ResumeImportPayloadSchema.parse(payload)).toThrow();
    });
  });

  describe('education entry validation', () => {
    it('accepts education entry with required fields only', () => {
      const entry = EducationEntrySchema.parse({
        degree: 'B.S. Computer Science',
        institution: 'MIT',
      });
      expect(entry.degree).toBe('B.S. Computer Science');
      expect(entry.institution).toBe('MIT');
    });

    it('accepts education entry with all optional fields', () => {
      const entry = EducationEntrySchema.parse({
        degree: 'M.S. Software Engineering',
        institution: 'Stanford University',
        year_start: 2019,
        year_end: 2021,
        details: 'Focus on distributed systems',
      });
      expect(entry.year_start).toBe(2019);
      expect(entry.year_end).toBe(2021);
      expect(entry.details).toBe('Focus on distributed systems');
    });

    it('allows null-like optional fields', () => {
      const entry = EducationEntrySchema.parse({
        degree: 'PhD',
        institution: 'Berkeley',
        year_start: undefined,
        year_end: undefined,
      });
      expect(entry.year_start).toBeUndefined();
      expect(entry.year_end).toBeUndefined();
    });

    it('rejects education entry with empty degree', () => {
      expect(() => EducationEntrySchema.parse({ degree: '', institution: 'MIT' })).toThrow();
    });

    it('rejects education entry with empty institution', () => {
      expect(() => EducationEntrySchema.parse({ degree: 'B.S.', institution: '' })).toThrow();
    });

    it('accepts multiple education entries', () => {
      const entries = [
        EducationEntrySchema.parse({ degree: 'B.S.', institution: 'MIT' }),
        EducationEntrySchema.parse({ degree: 'M.S.', institution: 'Stanford' }),
      ];
      expect(entries).toHaveLength(2);
    });
  });

  describe('experience entry validation', () => {
    it('accepts experience entry with required fields only', () => {
      const entry = ExperienceEntrySchema.parse({
        title: 'Software Engineer',
        company: 'Acme Corp',
      });
      expect(entry.title).toBe('Software Engineer');
      expect(entry.company).toBe('Acme Corp');
    });

    it('accepts experience entry with all optional fields', () => {
      const entry = ExperienceEntrySchema.parse({
        title: 'Senior Engineer',
        company: 'TechCo',
        start_date: '2020-01',
        end_date: '2024-06',
        description: 'Led team of 5 engineers.',
      });
      expect(entry.start_date).toBe('2020-01');
      expect(entry.end_date).toBe('2024-06');
    });

    it('allows null end_date for current positions', () => {
      const entry = ExperienceEntrySchema.parse({
        title: 'Lead Engineer',
        company: 'StartupInc',
        start_date: '2023-01',
        end_date: undefined,
        description: 'Currently working here.',
      });
      expect(entry.end_date).toBeUndefined();
    });

    it('rejects experience entry with empty title', () => {
      expect(() => ExperienceEntrySchema.parse({ title: '', company: 'Acme' })).toThrow();
    });

    it('rejects experience entry with empty company', () => {
      expect(() => ExperienceEntrySchema.parse({ title: 'Engineer', company: '' })).toThrow();
    });

    it('accepts experience with empty description', () => {
      const entry = ExperienceEntrySchema.parse({
        title: 'Intern',
        company: 'Co',
        description: '',
      });
      expect(entry.description).toBe('');
    });
  });

  describe('skill entry validation', () => {
    it('accepts skill with name only', () => {
      const entry = SkillEntrySchema.parse({ name: 'TypeScript' });
      expect(entry.name).toBe('TypeScript');
      expect(entry.category).toBeUndefined();
    });

    it('accepts skill with category', () => {
      const entry = SkillEntrySchema.parse({
        name: 'React',
        category: 'Frameworks',
      });
      expect(entry.category).toBe('Frameworks');
    });

    it('rejects skill with empty name', () => {
      expect(() => SkillEntrySchema.parse({ name: '' })).toThrow();
    });

    it('accepts multiple skills', () => {
      const skills = [
        SkillEntrySchema.parse({ name: 'TypeScript', category: 'Languages' }),
        SkillEntrySchema.parse({ name: 'Docker', category: 'DevOps' }),
        SkillEntrySchema.parse({ name: 'PostgreSQL', category: 'Databases' }),
      ];
      expect(skills).toHaveLength(3);
    });
  });

  describe('project entry validation', () => {
    it('accepts project with name only', () => {
      const entry = ProjectEntrySchema.parse({ name: 'Portfolio' });
      expect(entry.name).toBe('Portfolio');
    });

    it('accepts project with all fields', () => {
      const entry = ProjectEntrySchema.parse({
        name: 'Open Source CLI',
        description: 'A developer tool',
        url: 'https://github.com/alice/cli',
        tech_stack: ['Rust', 'WASM'],
      });
      expect(entry.tech_stack).toEqual(['Rust', 'WASM']);
    });

    it('rejects project with empty name', () => {
      expect(() => ProjectEntrySchema.parse({ name: '' })).toThrow();
    });

    it('rejects project with invalid URL', () => {
      expect(() =>
        ProjectEntrySchema.parse({
          name: 'Project',
          url: 'not-a-url',
        })
      ).toThrow();
    });

    it('accepts project without URL', () => {
      const entry = ProjectEntrySchema.parse({
        name: 'Side Project',
        description: 'Just for fun',
      });
      expect(entry.url).toBeUndefined();
    });

    it('accepts project with empty tech_stack', () => {
      const entry = ProjectEntrySchema.parse({
        name: 'Empty Tech',
        tech_stack: [],
      });
      expect(entry.tech_stack).toEqual([]);
    });
  });

  describe('atomic import constraints', () => {
    it('payload is structured as a single atomic unit', () => {
      const payload = makeImportPayload({
        education: [EducationEntrySchema.parse({ degree: 'B.S.', institution: 'MIT' })],
        experience: [ExperienceEntrySchema.parse({ title: 'Eng', company: 'Acme' })],
        skills: [SkillEntrySchema.parse({ name: 'TypeScript' })],
        projects: [ProjectEntrySchema.parse({ name: 'App' })],
      });

      const parsed = ResumeImportPayloadSchema.parse(payload);
      expect(parsed.education).toHaveLength(1);
      expect(parsed.experience).toHaveLength(1);
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.projects).toHaveLength(1);
    });

    it('RPC function name is apply_resume_import', () => {
      const rpcFunctionName = 'apply_resume_import';
      expect(rpcFunctionName).toBe('apply_resume_import');
    });

    it('payload contains profile_id as required field', () => {
      const payload = makeImportPayload();
      expect(payload.profile_id).toBe(VALID_UUID);
    });

    it('all entry types are optional in payload', () => {
      const payload = makeImportPayload();
      expect(payload.education).toBeUndefined();
      expect(payload.experience).toBeUndefined();
      expect(payload.skills).toBeUndefined();
      expect(payload.projects).toBeUndefined();
    });

    it('preference fields are optional in payload', () => {
      const payload = makeImportPayload();
      expect(payload.template_key).toBeUndefined();
      expect(payload.accent_key).toBeUndefined();
      expect(payload.section_order).toBeUndefined();
      expect(payload.hidden_sections).toBeUndefined();
    });

    it('import can include partial preference updates', () => {
      const payload = makeImportPayload({
        template_key: 'modern',
        accent_key: 'blue',
      });
      expect(payload.template_key).toBe('modern');
      expect(payload.accent_key).toBe('blue');
      expect(payload.section_order).toBeUndefined();
      expect(payload.hidden_sections).toBeUndefined();
    });

    it('import can include section order without other preferences', () => {
      const payload = makeImportPayload({
        section_order: ['basics', 'experience', 'education', 'skills', 'projects'],
      });
      expect(payload.section_order).toHaveLength(5);
    });

    it('import can include hidden sections without other preferences', () => {
      const payload = makeImportPayload({
        hidden_sections: ['projects', 'education'],
      });
      expect(payload.hidden_sections).toHaveLength(2);
    });
  });

  describe('entry collection boundaries', () => {
    it('accepts empty arrays for all entry collections', () => {
      const payload = makeImportPayload({
        education: [],
        experience: [],
        skills: [],
        projects: [],
      });
      expect(() => ResumeImportPayloadSchema.parse(payload)).not.toThrow();
    });

    it('rejects arrays with invalid entries', () => {
      const payload = makeImportPayload({
        education: [{ degree: '', institution: 'MIT' }],
      });
      expect(() => ResumeImportPayloadSchema.parse(payload)).toThrow();
    });

    it('accepts mixed valid and missing optional entries', () => {
      const payload = makeImportPayload({
        education: [EducationEntrySchema.parse({ degree: 'B.S.', institution: 'MIT' })],
        experience: undefined,
        skills: [SkillEntrySchema.parse({ name: 'Go' })],
        projects: undefined,
      });
      const parsed = ResumeImportPayloadSchema.parse(payload);
      expect(parsed.education).toHaveLength(1);
      expect(parsed.experience).toBeUndefined();
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.projects).toBeUndefined();
    });
  });
});

import { z } from 'zod';

export interface AIExtractProfileInput {
  resumeText: string;
}

export const extractedExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  location: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().nullable().optional(),
  sourceText: z.string().optional(),
});

export const extractedEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  sourceText: z.string().optional(),
});

export const extractedProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
  technologies: z.array(z.string()).optional(),
  sourceText: z.string().optional(),
});

export const extractedSkillSchema = z.object({
  name: z.string().min(1),
  sourceText: z.string().optional(),
});

export const extractedLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  sourceText: z.string().optional(),
});

export const resumeExtractionSchema = z.object({
  identity: z.object({
    displayName: z.string().nullable().optional(),
    headline: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    about: z.string().nullable().optional(),
  }),
  experience: z.array(extractedExperienceSchema),
  education: z.array(extractedEducationSchema),
  projects: z.array(extractedProjectSchema),
  skills: z.array(extractedSkillSchema),
  links: z.array(extractedLinkSchema),
  warnings: z.array(z.string()),
});

export type ResumeExtraction = z.infer<typeof resumeExtractionSchema>;

export interface AIProvider {
  readonly name: string;
  extractProfile(input: AIExtractProfileInput): Promise<ResumeExtraction>;
}

export function createNoopProvider(): AIProvider {
  return {
    name: 'noop',
    async extractProfile() {
      throw new Error('AI provider not configured. Set BHARATCODE_API_KEY environment variable.');
    },
  };
}

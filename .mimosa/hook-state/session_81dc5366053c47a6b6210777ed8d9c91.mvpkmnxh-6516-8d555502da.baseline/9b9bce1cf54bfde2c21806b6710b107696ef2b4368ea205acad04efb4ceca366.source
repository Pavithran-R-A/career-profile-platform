import { z } from 'zod';

export const identitySchema = z.object({
  fullName: z.string().min(1).max(255),
  headline: z.string().max(255),
  location: z.string().nullish(),
  avatarUrl: z.string().url().nullish(),
});

export const profileLinkSchema = z.object({
  label: z.string().min(1).max(255),
  url: z.string().url(),
});

export const profileSkillSchema = z.object({
  name: z.string().min(1).max(100),
  evidenceCount: z.number().int().nonnegative().default(0),
});

export const experienceSchema = z.object({
  id: z.string().uuid(),
  role: z.string().min(1).max(255),
  company: z.string().min(1).max(255),
  location: z.string().nullish(),
  startDate: z.string(),
  endDate: z.string().nullish(),
  description: z.string(),
});

export const educationSchema = z.object({
  id: z.string().uuid(),
  degree: z.string().min(1).max(255),
  institution: z.string().min(1).max(255),
  field: z.string().nullish(),
  startDate: z.string(),
  endDate: z.string().nullish(),
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string(),
  url: z.string().url().nullish(),
  repoUrl: z.string().url().nullish(),
  technologies: z.array(z.string().min(1).max(100)),
});

export const preferencesSchema = z.object({
  username: z.string().min(2).max(64),
  visibility: z.enum(['draft', 'published']),
  showEmail: z.boolean(),
});

export const profileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  identity: identitySchema,
  about: z.string().nullish(),
  experiences: z.array(experienceSchema),
  education: z.array(educationSchema),
  projects: z.array(projectSchema),
  skills: z.array(profileSkillSchema),
  links: z.array(profileLinkSchema),
  preferences: preferencesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;
export type ProfilePreferences = z.infer<typeof preferencesSchema>;

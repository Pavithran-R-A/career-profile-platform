/**
 * Canonical profile domain types.
 *
 * This file is intentionally free of runtime dependencies so it can be imported
 * by both browser and server code without introducing a boundary violation.
 */
export const PROFILE_VISIBILITY = {
  draft: 'draft',
  published: 'published',
} as const;

export type ProfileVisibility = (typeof PROFILE_VISIBILITY)[keyof typeof PROFILE_VISIBILITY];

export interface ProfileIdentity {
  fullName: string;
  headline: string;
  location: string | null;
  avatarUrl: string | null;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface ProfileSkill {
  name: string;
  evidenceCount: number;
}

export interface ProfileExperience {
  id: string;
  role: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string;
}

export interface ProfileEducation {
  id: string;
  degree: string;
  institution: string;
  field: string | null;
  startDate: string;
  endDate: string | null;
}

export interface ProfileProject {
  id: string;
  name: string;
  description: string;
  url: string | null;
  repoUrl: string | null;
  technologies: string[];
}

export interface ProfilePreferences {
  username: string;
  visibility: ProfileVisibility;
  showEmail: boolean;
}

export interface Profile {
  id: string;
  userId: string;
  identity: ProfileIdentity;
  about: string | null;
  experiences: ProfileExperience[];
  education: ProfileEducation[];
  projects: ProfileProject[];
  skills: ProfileSkill[];
  links: ProfileLink[];
  preferences: ProfilePreferences;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProfile {
  username: string;
  identity: ProfileIdentity;
  about: string | null;
  experiences: ProfileExperience[];
  education: ProfileEducation[];
  projects: ProfileProject[];
  skills: ProfileSkill[];
  links: ProfileLink[];
  visibility: ProfileVisibility;
  publishedAt: string | null;
}

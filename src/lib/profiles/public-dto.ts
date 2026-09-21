import type { ProfileVisibility } from './types';

export interface PublicProfileDto {
  username: string;
  displayName: string | null;
  headline: string | null;
  location: string | null;
  avatarUrl: string | null;
  about: string | null;
  visibility: ProfileVisibility;
  publishedAt: string | null;
  templateKey: string;
  accentKey: string;
  sectionOrder: string[];
  hiddenSections: string[];
}

export interface PublicExperienceDto {
  id: string;
  role: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface PublicEducationDto {
  id: string;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
}

export interface PublicProjectDto {
  id: string;
  name: string;
  description: string | null;
  projectUrl: string | null;
  repositoryUrl: string | null;
}

export interface PublicSkillDto {
  id: string;
  name: string;
  category: string | null;
}

export interface PublicLinkDto {
  id: string;
  label: string;
  url: string;
}

export interface PublicProfileFullDto {
  profile: PublicProfileDto;
  experiences: PublicExperienceDto[];
  education: PublicEducationDto[];
  projects: PublicProjectDto[];
  skills: PublicSkillDto[];
  links: PublicLinkDto[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw);
  if (ISO_DATE.test(s)) return s;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const y = Math.floor(n / 100);
  const m = n % 100;
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

export function toPublicProfileDto(raw: {
  username: string;
  display_name: string | null;
  headline: string | null;
  location: string | null;
  avatar_url: string | null;
  about: string | null;
  visibility: ProfileVisibility;
  published_at: string | null;
  template_key?: string | null;
  accent_key?: string | null;
  section_order?: string[] | null;
  hidden_sections?: string[] | null;
}): PublicProfileDto {
  return {
    username: raw.username,
    displayName: raw.display_name,
    headline: raw.headline,
    location: raw.location,
    avatarUrl: raw.avatar_url,
    about: raw.about,
    visibility: raw.visibility,
    publishedAt: raw.published_at,
    templateKey: raw.template_key ?? 'classic',
    accentKey: raw.accent_key ?? 'blue',
    sectionOrder: raw.section_order ?? ['basics', 'education', 'experience', 'skills', 'projects'],
    hiddenSections: raw.hidden_sections ?? [],
  };
}

export function toPublicExperienceDto(raw: {
  id: string;
  role: string;
  company: string;
  location: string | null;
  start_year: number;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  description: string | null;
}): PublicExperienceDto {
  const start = raw.start_month
    ? `${raw.start_year}-${String(raw.start_month).padStart(2, '0')}`
    : `${raw.start_year}`;
  const end =
    raw.end_year == null
      ? null
      : raw.end_month
        ? `${raw.end_year}-${String(raw.end_month).padStart(2, '0')}`
        : `${raw.end_year}`;

  return {
    id: raw.id,
    role: raw.role,
    company: raw.company,
    location: raw.location,
    startDate: start,
    endDate: end,
    description: raw.description,
  };
}

export function toPublicEducationDto(raw: {
  id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  description: string | null;
}): PublicEducationDto {
  const start =
    raw.start_year == null
      ? null
      : raw.start_month
        ? `${raw.start_year}-${String(raw.start_month).padStart(2, '0')}`
        : `${raw.start_year}`;
  const end =
    raw.end_year == null
      ? null
      : raw.end_month
        ? `${raw.end_year}-${String(raw.end_month).padStart(2, '0')}`
        : `${raw.end_year}`;

  return {
    id: raw.id,
    institution: raw.institution,
    degree: raw.degree,
    fieldOfStudy: raw.field_of_study,
    startDate: formatDate(start),
    endDate: formatDate(end),
    description: raw.description,
  };
}

export function toPublicProjectDto(raw: {
  id: string;
  name: string;
  description: string | null;
  project_url: string | null;
  repository_url: string | null;
}): PublicProjectDto {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    projectUrl: raw.project_url,
    repositoryUrl: raw.repository_url,
  };
}

export function toPublicSkillDto(raw: {
  id: string;
  name: string;
  category: string | null;
}): PublicSkillDto {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
  };
}

export function toPublicLinkDto(raw: { id: string; label: string; url: string }): PublicLinkDto {
  return {
    id: raw.id,
    label: raw.label,
    url: raw.url,
  };
}

export function toFullPublicDto(
  rawProfile: {
    username: string;
    display_name: string | null;
    headline: string | null;
    location: string | null;
    avatar_url: string | null;
    about: string | null;
    visibility: ProfileVisibility;
    published_at: string | null;
    template_key?: string | null;
    accent_key?: string | null;
    section_order?: string[] | null;
    hidden_sections?: string[] | null;
  },
  rawExperiences: {
    id: string;
    role: string;
    company: string;
    location: string | null;
    start_year: number;
    start_month: number | null;
    end_year: number | null;
    end_month: number | null;
    description: string | null;
  }[],
  rawEducation: {
    id: string;
    institution: string;
    degree: string | null;
    field_of_study: string | null;
    start_year: number | null;
    start_month: number | null;
    end_year: number | null;
    end_month: number | null;
    description: string | null;
  }[],
  rawProjects: {
    id: string;
    name: string;
    description: string | null;
    project_url: string | null;
    repository_url: string | null;
  }[],
  rawSkills: {
    id: string;
    name: string;
    category: string | null;
  }[],
  rawLinks: {
    id: string;
    label: string;
    url: string;
  }[]
): PublicProfileFullDto {
  return {
    profile: toPublicProfileDto(rawProfile),
    experiences: rawExperiences.map(toPublicExperienceDto),
    education: rawEducation.map(toPublicEducationDto),
    projects: rawProjects.map(toPublicProjectDto),
    skills: rawSkills.map(toPublicSkillDto),
    links: rawLinks.map(toPublicLinkDto),
  };
}

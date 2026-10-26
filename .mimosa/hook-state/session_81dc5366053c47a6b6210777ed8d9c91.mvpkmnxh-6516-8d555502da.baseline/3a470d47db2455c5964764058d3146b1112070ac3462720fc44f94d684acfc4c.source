import type { Profile } from '../profiles/types';

export interface ATSResumeViewModel {
  name: string;
  headline: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  links: ATSResumeLink[];
  summary: string | null;
  experience: ATSResumeExperience[];
  education: ATSResumeEducation[];
  skills: ATSResumeSkill[];
  projects: ATSResumeProject[];
}

export interface ATSResumeLink {
  label: string;
  url: string;
}

export interface ATSResumeExperience {
  role: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string;
}

export interface ATSResumeEducation {
  degree: string;
  institution: string;
  field: string | null;
  startDate: string;
  endDate: string | null;
}

export interface ATSResumeSkill {
  name: string;
  category: string | null;
}

export interface ATSResumeProject {
  name: string;
  description: string;
  url: string | null;
  technologies: string[];
}

export interface ATSContactSettings {
  email: string | null;
  phone: string | null;
  showEmail: boolean;
  showPhone: boolean;
}

export function buildATSViewModel(
  profile: Profile,
  contactSettings: ATSContactSettings
): ATSResumeViewModel {
  return {
    name: profile.identity.fullName,
    headline: profile.identity.headline,
    location: profile.identity.location,
    email: contactSettings.showEmail ? contactSettings.email : null,
    phone: contactSettings.showPhone ? contactSettings.phone : null,
    links: profile.links.map((link) => ({
      label: link.label,
      url: link.url,
    })),
    summary: profile.about,
    experience: profile.experiences.map((exp) => ({
      role: exp.role,
      company: exp.company,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.endDate,
      description: exp.description,
    })),
    education: profile.education.map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      field: edu.field,
      startDate: edu.startDate,
      endDate: edu.endDate,
    })),
    skills: profile.skills.map((skill) => ({
      name: skill.name,
      category: null,
    })),
    projects: profile.projects.map((project) => ({
      name: project.name,
      description: project.description,
      url: project.url,
      technologies: project.technologies,
    })),
  };
}

export function extractPlainText(viewModel: ATSResumeViewModel): string {
  const lines: string[] = [];

  lines.push(viewModel.name);
  lines.push(viewModel.headline);

  if (viewModel.location) {
    lines.push(viewModel.location);
  }

  const contactParts: string[] = [];
  if (viewModel.email) contactParts.push(viewModel.email);
  if (viewModel.phone) contactParts.push(viewModel.phone);
  if (contactParts.length > 0) {
    lines.push(contactParts.join(' | '));
  }

  if (viewModel.links.length > 0) {
    lines.push(viewModel.links.map((l) => `${l.label}: ${l.url}`).join(' | '));
  }

  lines.push('');

  if (viewModel.summary) {
    lines.push('SUMMARY');
    lines.push(viewModel.summary);
    lines.push('');
  }

  if (viewModel.experience.length > 0) {
    lines.push('EXPERIENCE');
    for (const exp of viewModel.experience) {
      lines.push(`${exp.role} — ${exp.company}`);
      const dateRange = exp.endDate
        ? `${exp.startDate} – ${exp.endDate}`
        : `${exp.startDate} – Present`;
      const locationPart = exp.location ? ` | ${exp.location}` : '';
      lines.push(`${dateRange}${locationPart}`);
      lines.push(exp.description);
      lines.push('');
    }
  }

  if (viewModel.education.length > 0) {
    lines.push('EDUCATION');
    for (const edu of viewModel.education) {
      const fieldPart = edu.field ? ` in ${edu.field}` : '';
      lines.push(`${edu.degree}${fieldPart} — ${edu.institution}`);
      const dateRange = edu.endDate
        ? `${edu.startDate} – ${edu.endDate}`
        : `${edu.startDate} – Present`;
      lines.push(dateRange);
      lines.push('');
    }
  }

  if (viewModel.skills.length > 0) {
    lines.push('SKILLS');
    lines.push(viewModel.skills.map((s) => s.name).join(', '));
    lines.push('');
  }

  if (viewModel.projects.length > 0) {
    lines.push('PROJECTS');
    for (const project of viewModel.projects) {
      lines.push(project.name);
      if (project.url) {
        lines.push(project.url);
      }
      lines.push(project.description);
      if (project.technologies.length > 0) {
        lines.push(`Technologies: ${project.technologies.join(', ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

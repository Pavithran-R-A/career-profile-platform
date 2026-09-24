import type { ProfileWithRelations } from '../profiles/repository';
import type { ATSResumeViewModel } from './ats-view-model';

export function toATSExportModel(
  profile: ProfileWithRelations,
  options: {
    headline: string;
    summary: string;
    email: string;
    phone: string;
    selectedSkills: ReadonlySet<string>;
    selectedExperiences: ReadonlySet<number>;
    selectedEducation: ReadonlySet<number>;
    selectedProjects: ReadonlySet<number>;
  }
): ATSResumeViewModel {
  return {
    name: profile.display_name || profile.username,
    headline: options.headline || profile.headline || '',
    location: profile.location,
    email: options.email.trim() || null,
    phone: options.phone.trim() || null,
    summary: options.summary || profile.about,
    links: profile.links.map(({ label, url }) => ({ label, url })),
    experience: profile.experiences
      .filter((_, index) => options.selectedExperiences.has(index))
      .map((item) => ({
        role: item.role,
        company: item.company,
        location: item.location,
        startDate: `${item.start_year}${item.start_month ? `-${String(item.start_month).padStart(2, '0')}` : ''}`,
        endDate: item.end_year
          ? `${item.end_year}${item.end_month ? `-${String(item.end_month).padStart(2, '0')}` : ''}`
          : null,
        description: item.description || '',
      })),
    education: profile.education
      .filter((_, index) => options.selectedEducation.has(index))
      .map((item) => ({
        institution: item.institution,
        degree: item.degree || '',
        field: item.field_of_study,
        startDate: item.start_year ? String(item.start_year) : '',
        endDate: item.end_year ? String(item.end_year) : null,
      })),
    skills: profile.skills
      .filter((item) => options.selectedSkills.has(item.name))
      .map((item) => ({ name: item.name, category: item.category })),
    projects: profile.projects
      .filter((_, index) => options.selectedProjects.has(index))
      .map((item) => ({
        name: item.name,
        description: item.description || '',
        url: item.project_url,
        technologies: [],
      })),
  };
}

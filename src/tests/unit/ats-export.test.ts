import { describe, expect, it } from 'vitest';
import { toATSExportModel } from '../../lib/resume/ats-export';
import type { ProfileWithRelations } from '../../lib/profiles/repository';

const profile: ProfileWithRelations = {
  id: 'profile-id',
  user_id: 'user-id',
  username: 'synthetic',
  display_name: 'Synthetic Candidate',
  headline: 'Engineer',
  about: 'Built useful things.',
  location: 'Test City',
  avatar_url: null,
  visibility: 'published',
  published_at: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  experiences: [
    {
      id: 'exp-1',
      profile_id: 'profile-id',
      company: 'Example Works',
      role: 'Developer',
      location: null,
      start_year: 2020,
      start_month: 3,
      end_year: null,
      end_month: null,
      is_current: true,
      description: 'Built tools.',
      sort_order: 0,
      created_at: '',
      updated_at: '',
    },
  ],
  education: [
    {
      id: 'edu-1',
      profile_id: 'profile-id',
      institution: 'Example University',
      degree: 'BSc',
      field_of_study: 'Computer Science',
      start_year: 2016,
      start_month: null,
      end_year: 2020,
      end_month: null,
      description: null,
      sort_order: 0,
      created_at: '',
      updated_at: '',
    },
  ],
  skills: [
    {
      id: 'skill-1',
      profile_id: 'profile-id',
      name: 'TypeScript',
      category: null,
      sort_order: 0,
      created_at: '',
      updated_at: '',
    },
  ],
  projects: [
    {
      id: 'project-1',
      profile_id: 'profile-id',
      name: 'Synthetic Project',
      description: 'Example app',
      project_url: null,
      repository_url: null,
      sort_order: 0,
      created_at: '',
      updated_at: '',
    },
  ],
  links: [],
};

describe('ATS export from an owner profile', () => {
  it('does not use the authentication email and respects section selections', () => {
    const model = toATSExportModel(profile, {
      headline: '',
      summary: '',
      email: '',
      phone: '',
      selectedSkills: new Set(['TypeScript']),
      selectedExperiences: new Set([0]),
      selectedEducation: new Set(),
      selectedProjects: new Set([0]),
    });
    expect(model.email).toBeNull();
    expect(model.name).toBe('Synthetic Candidate');
    expect(model.experience[0].startDate).toBe('2020-03');
    expect(model.education).toEqual([]);
    expect(model.skills[0].name).toBe('TypeScript');
    expect(model.projects[0].name).toBe('Synthetic Project');
  });
});

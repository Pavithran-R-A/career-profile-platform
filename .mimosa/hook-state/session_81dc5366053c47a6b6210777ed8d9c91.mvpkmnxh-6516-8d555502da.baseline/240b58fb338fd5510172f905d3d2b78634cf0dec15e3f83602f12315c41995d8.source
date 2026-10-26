import type { ProfileWithRelations } from '../../../lib/profiles/repository';

/**
 * Shared synthetic profile fixture for template/Appearance rendering tests.
 * Deliberately not a real user; stable across runs.
 */
export function makeTemplateProfileFixture(): ProfileWithRelations {
  return {
    id: 'profile-id',
    user_id: 'user-1',
    username: 'synthetic',
    display_name: 'Synthetic Candidate',
    headline: 'Software Engineer',
    about: 'Built reliable software.',
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
        role: 'Senior Developer',
        location: null,
        start_year: 2020,
        start_month: null,
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
        name: 'Example Project',
        description: 'An open source demonstration.',
        project_url: null,
        repository_url: null,
        sort_order: 0,
        created_at: '',
        updated_at: '',
      },
    ],
    links: [
      {
        id: 'link-1',
        profile_id: 'profile-id',
        label: 'GitHub',
        url: 'https://github.com/synthetic',
        sort_order: 0,
        created_at: '',
        updated_at: '',
      },
    ],
  };
}

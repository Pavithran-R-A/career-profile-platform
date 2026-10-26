import { describe, it, expect } from 'vitest';
import { buildATSViewModel, type ATSContactSettings } from '../../lib/resume/ats-view-model';
import type { Profile } from '../../lib/profiles/types';

// Tests the SHIPPED view-model builder (src/lib/resume/ats-view-model.ts).
// No logic is duplicated here — only realistic Profile fixtures and
// assertions on its documented output shape.

const profile: Profile = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  identity: {
    fullName: 'Boundary Candidate',
    headline: 'Senior QA Engineer',
    location: 'Pune, India',
    avatarUrl: null,
  },
  about: 'Built reliable release pipelines for fictional teams.',
  experiences: [
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      role: 'QA Lead',
      company: 'Example Works',
      location: 'Remote',
      startDate: '2020',
      endDate: null,
      description: 'Owned the automated regression suite.',
    },
  ],
  education: [
    {
      id: '550e8400-e29b-41d4-a716-446655440020',
      degree: 'B.Tech',
      institution: 'Example University',
      field: 'Computer Science',
      startDate: '2016',
      endDate: '2020',
    },
  ],
  projects: [
    {
      id: '550e8400-e29b-41d4-a716-446655440030',
      name: 'Open Source Demo',
      description: 'An open source demonstration project.',
      url: 'https://example.org/demo',
      repoUrl: 'https://github.com/example/demo',
      technologies: ['TypeScript'],
    },
  ],
  skills: [
    { name: 'TypeScript', evidenceCount: 4 },
    { name: 'Playwright', evidenceCount: 2 },
  ],
  links: [{ label: 'GitHub', url: 'https://github.com/example' }],
  preferences: {
    username: 'boundary',
    visibility: 'published',
    showEmail: true,
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};

const contact: ATSContactSettings = {
  email: 'boundary@example.invalid',
  phone: '+91 90000 00000',
  showEmail: true,
  showPhone: true,
};

describe('buildATSViewModel (production)', () => {
  it('maps identity, summary and relations in ATS order', () => {
    const vm = buildATSViewModel(profile, contact);
    expect(vm.name).toBe('Boundary Candidate');
    expect(vm.headline).toBe('Senior QA Engineer');
    expect(vm.summary).toContain('release pipelines');
    expect(vm.experience[0]?.role).toBe('QA Lead');
    expect(vm.education[0]?.institution).toBe('Example University');
    expect(vm.skills.map((s) => s.name)).toContain('TypeScript');
    expect(vm.projects[0]?.name).toBe('Open Source Demo');
  });

  it('honors contact visibility toggles', () => {
    const hidden = buildATSViewModel(profile, { ...contact, showEmail: false, showPhone: false });
    expect(hidden.email).toBeNull();
    expect(hidden.phone).toBeNull();
    const shown = buildATSViewModel(profile, contact);
    expect(shown.email).toBe('boundary@example.invalid');
    expect(shown.phone).toBe('+91 90000 00000');
  });

  it('never invents contact data that is not in the profile settings', () => {
    const vm = buildATSViewModel(profile, {
      email: null,
      phone: null,
      showEmail: true,
      showPhone: true,
    });
    expect(vm.email).toBeNull();
    expect(vm.phone).toBeNull();
  });

  it('keeps empty relations as empty arrays rather than dropping keys', () => {
    const empty = buildATSViewModel(
      { ...profile, experiences: [], education: [], projects: [], links: [] },
      contact
    );
    expect(empty.experience).toEqual([]);
    expect(empty.education).toEqual([]);
    expect(empty.projects).toEqual([]);
    expect(empty.links).toEqual([]);
  });
});

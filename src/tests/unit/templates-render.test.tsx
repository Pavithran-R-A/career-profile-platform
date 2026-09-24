import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { getTemplate } from '../../lib/templates/types';
import {
  ensureTemplatesRegistered,
  getTemplateComponent,
  TEMPLATE_KEYS,
  type TemplatePreferencesInput,
} from '../../lib/templates/registry';
import type { ProfileWithRelations } from '../../lib/profiles/repository';

function makeProfile(): ProfileWithRelations {
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

const PREFS: TemplatePreferencesInput = {
  accentKey: 'rose',
  sectionOrder: ['basics', 'education', 'experience', 'projects', 'skills', 'links'],
  hiddenSections: ['skills'],
};

describe('template registry (actual registry code)', () => {
  it('registers exactly minimal, editorial and technical', () => {
    ensureTemplatesRegistered();
    ensureTemplatesRegistered();
    expect([...TEMPLATE_KEYS]).toEqual(['minimal', 'editorial', 'technical']);
    for (const key of TEMPLATE_KEYS) {
      expect(getTemplate(key)?.metadata.id).toBe(key);
    }
  });

  it('falls back to the minimal renderer for unknown keys', () => {
    expect(getTemplateComponent('unknown')).toBe(getTemplateComponent('minimal'));
  });
});

describe('template render (one synthetic fixture)', () => {
  it('Minimal renders content, honors order/hidden/accent, omits nothing expected', () => {
    const config = getTemplate('minimal')!.config;
    const Component = getTemplateComponent('minimal');
    const { container } = render(
      <Component profile={makeProfile()} config={config} preferences={PREFS} />
    );
    const html = container.innerHTML;
    expect(container.textContent).toContain('Synthetic Candidate');
    expect(container.textContent).toContain('Senior Developer');
    expect(container.textContent).toContain('Example University');
    // hidden section absent
    expect(container.textContent).not.toContain('TypeScript');
    // custom order: education before experience
    expect(html.indexOf('Example University')).toBeLessThan(html.indexOf('Senior Developer'));
    // accent preference applied (jsdom normalizes hex to rgb)
    expect(html).toContain('rgb(225, 29, 72)');
  });

  it('Editorial renders the two-column sidebar and honors hidden sections', () => {
    const config = getTemplate('editorial')!.config;
    const Component = getTemplateComponent('editorial');
    const { container } = render(
      <Component profile={makeProfile()} config={config} preferences={PREFS} />
    );
    expect(container.querySelector('aside')).not.toBeNull();
    expect(container.textContent).toContain('Experience');
    expect(container.textContent).toContain('Example Project');
    expect(container.textContent).not.toContain('TypeScript');
    expect(container.innerHTML).toContain('rgb(225, 29, 72)');
  });

  it('Technical renders terminal markers and honors hidden sections', () => {
    const config = getTemplate('technical')!.config;
    const Component = getTemplateComponent('technical');
    const { container } = render(
      <Component profile={makeProfile()} config={config} preferences={PREFS} />
    );
    expect(container.textContent).toContain('> experience');
    expect(container.textContent).toContain('GitHub');
    expect(container.textContent).not.toContain('TypeScript');
    expect(container.innerHTML).toContain('rgb(225, 29, 72)');
  });

  it('empty sections are omitted from every template', () => {
    for (const key of TEMPLATE_KEYS) {
      const config = getTemplate(key)!.config;
      const Component = getTemplateComponent(key);
      const profile = { ...makeProfile(), projects: [] };
      const { container, unmount } = render(
        <Component profile={profile} config={config} preferences={PREFS} />
      );
      expect(container.textContent).not.toContain('Example Project');
      unmount();
    }
  });
});

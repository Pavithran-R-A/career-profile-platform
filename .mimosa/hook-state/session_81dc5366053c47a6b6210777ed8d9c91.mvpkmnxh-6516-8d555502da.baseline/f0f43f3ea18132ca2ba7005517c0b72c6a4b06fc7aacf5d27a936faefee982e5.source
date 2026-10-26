import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ensureTemplatesRegistered, getTemplateComponent } from '../../lib/templates/registry';
import { getTemplate } from '../../lib/templates/types';
import {
  initialAppearanceState,
  setTemplate,
  setAccent,
  moveSection,
  setSectionHidden,
} from '../../lib/profiles/appearance-draft';
import { TemplateCanvas } from '../../components/portfolio/TemplateCanvas';
import { makeTemplateProfileFixture } from './fixtures/template-profile';

ensureTemplatesRegistered();

/**
 * PREVIEW FIDELITY REGRESSION.
 *
 * The Appearance live preview and the real public portfolio must share the
 * same template registry, DTO interpretation, section order, hidden sections
 * and accent. The owner preview renders through TemplateCanvas from the DRAFT
 * state; the public page renders the template component directly from SAVED
 * state. This test drives one draft through interactions, renders both paths
 * from it, and asserts the output matches structurally.
 */
describe('preview fidelity: draft state vs saved public output', () => {
  it('TemplateCanvas(draft) and direct template render(structural match)', () => {
    const profile = makeTemplateProfileFixture();

    // Owner edits: switch template, accent, hide skills, move skills up.
    let draft = initialAppearanceState({
      id: 'prefs',
      profile_id: profile.id,
      template_key: 'minimal',
      accent_key: 'blue',
      section_order: ['basics', 'experience', 'education', 'projects', 'skills', 'links'],
      hidden_sections: [],
    });
    draft = setTemplate(draft, 'editorial');
    draft = setAccent(draft, 'rose');
    draft = moveSection(draft, 2, -1); // education above experience
    draft = setSectionHidden(draft, 'skills', true);

    const prefs = draft.current;
    const templateConfig = getTemplate(prefs.template_key)!.config;

    // Path 1: owner live preview (TemplateCanvas, from draft)
    const preview = render(
      <TemplateCanvas
        templateKey={prefs.template_key}
        profile={profile}
        preferences={{
          accentKey: prefs.accent_key,
          sectionOrder: prefs.section_order,
          hiddenSections: prefs.hidden_sections,
        }}
        scale={1}
        height={800}
        label="draft preview"
      />
    );
    const previewHtml = preview.container.innerHTML;
    const previewText = preview.container.textContent ?? '';

    // Path 2: public output (direct component render, same preferences)
    const PublicComponent = getTemplateComponent(prefs.template_key);
    const pub = render(
      <PublicComponent
        profile={profile}
        config={templateConfig}
        preferences={{
          accentKey: prefs.accent_key,
          sectionOrder: prefs.section_order,
          hiddenSections: prefs.hidden_sections,
        }}
      />
    );
    const publicHtml = pub.container.innerHTML;
    const publicText = pub.container.textContent ?? '';

    // Same template structure (editorial sidebar)
    expect(preview.container.querySelector('aside')).not.toBeNull();
    expect(pub.container.querySelector('aside')).not.toBeNull();

    // Same section order: education before experience in BOTH
    expect(previewHtml.indexOf('Example University')).toBeLessThan(
      previewHtml.indexOf('Senior Developer')
    );
    expect(publicHtml.indexOf('Example University')).toBeLessThan(
      publicHtml.indexOf('Senior Developer')
    );

    // Same hidden-section behavior: skills hidden in BOTH
    expect(previewText).not.toContain('TypeScript');
    expect(publicText).not.toContain('TypeScript');

    // Same accent interpretation (draft emerald→rose was applied to both)
    expect(previewHtml).toContain('rgb(225, 29, 72)');
    expect(publicHtml).toContain('rgb(225, 29, 72)');

    // Same content everywhere
    expect(previewText).toContain('Synthetic Candidate');
    expect(publicText).toContain('Synthetic Candidate');
    expect(previewText).toContain('Example Project');
    expect(publicText).toContain('Example Project');

    preview.unmount();
    pub.unmount();
  });
});

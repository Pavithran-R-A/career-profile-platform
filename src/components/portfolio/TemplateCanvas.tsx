import { getTemplate } from '../../lib/templates/types';
import { ensureTemplatesRegistered, getTemplateComponent } from '../../lib/templates/registry';
import type { PortfolioProfile } from '../../lib/templates/types';

export interface TemplatePreferencesLike {
  accentKey?: string;
  sectionOrder?: string[];
  hiddenSections?: string[];
}

/**
 * Renders a real portfolio template (registry-backed) scaled to fit a box.
 * Single source of truth for every place the product previews a portfolio.
 */
export function TemplateCanvas({
  templateKey,
  profile,
  preferences,
  scale,
  height,
  label,
}: {
  templateKey: string;
  profile: PortfolioProfile;
  preferences?: TemplatePreferencesLike;
  scale: number;
  height: number;
  label?: string;
}) {
  ensureTemplatesRegistered();
  const template = getTemplate(templateKey) ?? getTemplate('minimal')!;
  const Component = getTemplateComponent(templateKey);

  return (
    <div
      className="relative overflow-hidden"
      style={{ height, background: template.config.colors.background }}
      role="img"
      aria-label={label ?? `${template.metadata.name} portfolio preview`}>
      <div
        aria-hidden="true"
        className="absolute top-0 left-0"
        style={{
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}>
        <Component
          profile={profile}
          config={template.config}
          preferences={
            preferences
              ? {
                  accentKey: preferences.accentKey ?? 'blue',
                  sectionOrder: preferences.sectionOrder ?? [],
                  hiddenSections: preferences.hiddenSections ?? [],
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

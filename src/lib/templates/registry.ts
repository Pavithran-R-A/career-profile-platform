import type { ComponentType } from 'react';
import {
  registerTemplate,
  type PortfolioProfile,
  type Template,
  type TemplateConfig,
} from './types';
import MinimalTemplate from '../../components/templates/MinimalTemplate';
import EditorialTemplate from '../../components/templates/EditorialTemplate';
import TechnicalTemplate from '../../components/templates/TechnicalTemplate';

export type { PortfolioProfile } from './types';

export interface TemplatePreferencesInput {
  accentKey: string;
  sectionOrder: string[];
  hiddenSections: string[];
}

export interface TemplateRendererProps {
  profile: PortfolioProfile;
  config: TemplateConfig;
  preferences?: TemplatePreferencesInput;
}

export type TemplateRenderer = ComponentType<TemplateRendererProps>;

export const TEMPLATE_KEYS = ['minimal', 'editorial', 'technical'] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

const MINIMAL_CONFIG: TemplateConfig = {
  colors: {
    primary: '#111827',
    secondary: '#4b5563',
    accent: '#2563eb',
    background: '#ffffff',
    text: '#111827',
    muted: '#6b7280',
  },
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, monospace',
  },
  layout: 'single',
  spacing: 'normal',
  borderRadius: 'small',
};

const EDITORIAL_CONFIG: TemplateConfig = {
  colors: {
    primary: '#1c1917',
    secondary: '#57534e',
    accent: '#7c3aed',
    background: '#faf6ee',
    text: '#1c1917',
    muted: '#6b645c',
  },
  fonts: {
    heading: 'Georgia, serif',
    body: 'Inter, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, monospace',
  },
  layout: 'sidebar',
  spacing: 'relaxed',
  borderRadius: 'none',
};

const TECHNICAL_CONFIG: TemplateConfig = {
  colors: {
    primary: '#e2e8f0',
    secondary: '#94a3b8',
    accent: '#22d3ee',
    background: '#0f172a',
    text: '#e2e8f0',
    muted: '#64748b',
  },
  fonts: {
    heading: 'ui-monospace, SFMono-Regular, monospace',
    body: 'ui-monospace, SFMono-Regular, monospace',
    mono: 'ui-monospace, SFMono-Regular, monospace',
  },
  layout: 'single',
  spacing: 'compact',
  borderRadius: 'none',
};

const TEMPLATE_DEFINITIONS: Template[] = [
  {
    metadata: {
      id: 'minimal',
      name: 'Minimal',
      description: 'Clean, lightweight single-column layout',
      version: '1.0.0',
      author: 'Career Profile Platform',
      tags: ['single-column', 'clean', 'minimal'],
      isDefault: true,
    },
    config: MINIMAL_CONFIG,
  },
  {
    metadata: {
      id: 'editorial',
      name: 'Editorial',
      description: 'Two-column sidebar layout for editorial feel',
      version: '1.0.0',
      author: 'Career Profile Platform',
      tags: ['sidebar', 'two-column', 'editorial'],
      isDefault: false,
    },
    config: EDITORIAL_CONFIG,
  },
  {
    metadata: {
      id: 'technical',
      name: 'Technical',
      description: 'Monospace terminal-style layout',
      version: '1.0.0',
      author: 'Career Profile Platform',
      tags: ['monospace', 'technical', 'dark'],
      isDefault: false,
    },
    config: TECHNICAL_CONFIG,
  },
];

/**
 * Canonical template key -> component mapping.
 * Single source of truth alongside TEMPLATE_DEFINITIONS above;
 * TemplateSelector reads metadata from the registry, rendering
 * resolves the component through getTemplateComponent.
 */
const TEMPLATE_COMPONENTS: Record<TemplateKey, TemplateRenderer> = {
  minimal: MinimalTemplate,
  editorial: EditorialTemplate,
  technical: TechnicalTemplate,
};

let registered = false;

/**
 * Explicit production registry initialization. Called once from the
 * application bootstrap (src/main.tsx). Idempotent so tests and
 * re-imports cannot double-register.
 */
export function ensureTemplatesRegistered(): void {
  if (registered) return;
  for (const template of TEMPLATE_DEFINITIONS) {
    registerTemplate(template);
  }
  registered = true;
}

export function getTemplateComponent(key: string): TemplateRenderer {
  if (key === 'minimal' || key === 'editorial' || key === 'technical') {
    return TEMPLATE_COMPONENTS[key];
  }
  return TEMPLATE_COMPONENTS.minimal;
}

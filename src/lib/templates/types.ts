import { z } from 'zod';

export const TemplateMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string(),
  thumbnail: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

export const TemplateConfigSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
    muted: z.string(),
  }),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
    mono: z.string(),
  }),
  layout: z.enum(['single', 'sidebar', 'two-column']),
  spacing: z.enum(['compact', 'normal', 'relaxed']),
  borderRadius: z.enum(['none', 'small', 'medium', 'large']),
});

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

export const TemplateSchema = z.object({
  metadata: TemplateMetadataSchema,
  config: TemplateConfigSchema,
});

export type Template = z.infer<typeof TemplateSchema>;

import type { ProfileWithRelations } from '../profiles/repository';
import type { PublicEvidenceItem } from '../evidence/public';

/**
 * Profiles rendered by portfolio templates. `user_id` is never needed for
 * presentation and is omitted from the public-safe shape, so it is optional.
 * `evidence` is only present on published public portfolios (owner-opted-in,
 * public-flagged evidence); owner previews may omit it.
 */
export type PortfolioProfile = Omit<ProfileWithRelations, 'user_id'> & {
  user_id?: string;
  evidence?: PublicEvidenceItem[];
};

/** Legacy stored orders used "about"; templates render it as "basics". */
export function normalizeSectionOrder(order: string[]): string[] {
  return order.map((section) => (section === 'about' ? 'basics' : section));
}

const templateRegistry = new Map<string, Template>();

export function registerTemplate(template: Template): void {
  templateRegistry.set(template.metadata.id, template);
}

export function getTemplate(id: string): Template | undefined {
  return templateRegistry.get(id);
}

export function getAllTemplates(): Template[] {
  return Array.from(templateRegistry.values());
}

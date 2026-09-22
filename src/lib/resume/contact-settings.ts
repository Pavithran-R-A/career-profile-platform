import { z } from 'zod';

export const contactSettingsSchema = z.object({
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  showEmail: z.boolean().default(true),
  showPhone: z.boolean().default(false),
});

export type ContactSettings = z.infer<typeof contactSettingsSchema>;

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  email: null,
  phone: null,
  showEmail: true,
  showPhone: false,
};

export function parseContactSettings(raw: unknown): ContactSettings {
  const result = contactSettingsSchema.safeParse(raw);
  if (!result.success) {
    return { ...DEFAULT_CONTACT_SETTINGS };
  }
  return result.data;
}

export function sanitizeContactSettings(settings: ContactSettings): ContactSettings {
  return {
    email: settings.email?.trim() || null,
    phone: settings.phone?.trim() || null,
    showEmail: Boolean(settings.showEmail),
    showPhone: Boolean(settings.showPhone),
  };
}

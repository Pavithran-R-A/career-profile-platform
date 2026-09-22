import { z } from 'zod';
import { getSupabaseClient } from '../supabase/client';
import { parseContactSettings, type ContactSettings } from './contact-settings';

export const resumeSettingsSchema = z.object({
  profileId: z.string().uuid(),
  templateKey: z.string().default('default'),
  accentKey: z.string().default('blue'),
  sectionOrder: z
    .array(z.string())
    .default(['summary', 'experience', 'education', 'skills', 'projects']),
  hiddenSections: z.array(z.string()).default([]),
  contactSettings: z.object({
    email: z.string().email().nullable().default(null),
    phone: z.string().nullable().default(null),
    showEmail: z.boolean().default(true),
    showPhone: z.boolean().default(false),
  }),
});

export type ResumeSettings = z.infer<typeof resumeSettingsSchema>;

const DEFAULT_SETTINGS: ResumeSettings = {
  profileId: '',
  templateKey: 'default',
  accentKey: 'blue',
  sectionOrder: ['summary', 'experience', 'education', 'skills', 'projects'],
  hiddenSections: [],
  contactSettings: {
    email: null,
    phone: null,
    showEmail: true,
    showPhone: false,
  },
};

export async function getResumeSettings(profileId: string): Promise<ResumeSettings> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('profile_preferences')
    .select('template_key, accent_key, section_order, hidden_sections')
    .eq('profile_id', profileId)
    .single();

  if (error || !data) {
    return { ...DEFAULT_SETTINGS, profileId };
  }

  const rawContact = await getStoredContactSettings(profileId);

  return {
    profileId,
    templateKey: data.template_key || DEFAULT_SETTINGS.templateKey,
    accentKey: data.accent_key || DEFAULT_SETTINGS.accentKey,
    sectionOrder: Array.isArray(data.section_order)
      ? (data.section_order as string[])
      : DEFAULT_SETTINGS.sectionOrder,
    hiddenSections: Array.isArray(data.hidden_sections)
      ? (data.hidden_sections as string[])
      : DEFAULT_SETTINGS.hiddenSections,
    contactSettings: parseContactSettings(rawContact),
  };
}

export async function updateResumeSettings(
  profileId: string,
  settings: Partial<Omit<ResumeSettings, 'profileId'>>
): Promise<ResumeSettings> {
  const supabase = getSupabaseClient();
  const current = await getResumeSettings(profileId);

  const updated: ResumeSettings = {
    ...current,
    ...settings,
    contactSettings: {
      ...current.contactSettings,
      ...(settings.contactSettings || {}),
    },
  };

  if (
    settings.templateKey ||
    settings.accentKey ||
    settings.sectionOrder ||
    settings.hiddenSections
  ) {
    const { error: prefError } = await supabase.from('profile_preferences').upsert(
      {
        profile_id: profileId,
        template_key: updated.templateKey,
        accent_key: updated.accentKey,
        section_order: updated.sectionOrder,
        hidden_sections: updated.hiddenSections,
      },
      { onConflict: 'profile_id' }
    );

    if (prefError) {
      throw new Error(`Failed to update resume settings: ${prefError.message}`);
    }
  }

  if (settings.contactSettings) {
    await storeContactSettings(profileId, updated.contactSettings);
  }

  return updated;
}

async function getStoredContactSettings(profileId: string): Promise<ContactSettings | null> {
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('profile_preferences')
    .select('hidden_sections')
    .eq('profile_id', profileId)
    .single();

  if (!data) return null;

  const hidden = data.hidden_sections as Record<string, unknown>;
  if (hidden && typeof hidden === 'object' && 'contactSettings' in hidden) {
    return parseContactSettings(hidden.contactSettings);
  }

  return null;
}

async function storeContactSettings(profileId: string, settings: ContactSettings): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('profile_preferences')
    .select('hidden_sections')
    .eq('profile_id', profileId)
    .single();

  const hiddenSections = existing
    ? { ...(existing.hidden_sections as Record<string, unknown>) }
    : {};

  hiddenSections.contactSettings = {
    email: settings.email,
    phone: settings.phone,
    showEmail: settings.showEmail,
    showPhone: settings.showPhone,
  };

  const { error } = await supabase.from('profile_preferences').upsert(
    {
      profile_id: profileId,
      hidden_sections: JSON.parse(JSON.stringify(hiddenSections)),
    },
    { onConflict: 'profile_id' }
  );

  if (error) {
    throw new Error(`Failed to store contact settings: ${error.message}`);
  }
}

export async function resetResumeSettings(profileId: string): Promise<ResumeSettings> {
  return updateResumeSettings(profileId, {
    templateKey: DEFAULT_SETTINGS.templateKey,
    accentKey: DEFAULT_SETTINGS.accentKey,
    sectionOrder: [...DEFAULT_SETTINGS.sectionOrder],
    hiddenSections: [...DEFAULT_SETTINGS.hiddenSections],
    contactSettings: { ...DEFAULT_SETTINGS.contactSettings },
  });
}

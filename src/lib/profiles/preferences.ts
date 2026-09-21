import { getSupabaseClient } from '../supabase/client';

export interface ProfilePreferences {
  id: string;
  profile_id: string;
  template_key: string;
  accent_key: string;
  section_order: string[];
  hidden_sections: string[];
}

const DEFAULT_TEMPLATE_KEY = 'minimal';
const DEFAULT_ACCENT_KEY = 'blue';
const DEFAULT_SECTION_ORDER = ['about', 'experience', 'education', 'projects', 'skills', 'links'];
const DEFAULT_HIDDEN_SECTIONS: string[] = [];

export async function getPreferences(profileId: string): Promise<ProfilePreferences | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_preferences')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    profile_id: data.profile_id,
    template_key: data.template_key || DEFAULT_TEMPLATE_KEY,
    accent_key: data.accent_key || DEFAULT_ACCENT_KEY,
    section_order: (data.section_order as string[]) || DEFAULT_SECTION_ORDER,
    hidden_sections: (data.hidden_sections as string[]) || DEFAULT_HIDDEN_SECTIONS,
  };
}

export async function upsertPreferences(
  profileId: string,
  updates: Partial<
    Pick<ProfilePreferences, 'template_key' | 'accent_key' | 'section_order' | 'hidden_sections'>
  >
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profile_preferences').upsert(
    {
      profile_id: profileId,
      template_key: updates.template_key ?? DEFAULT_TEMPLATE_KEY,
      accent_key: updates.accent_key ?? DEFAULT_ACCENT_KEY,
      section_order: updates.section_order ?? DEFAULT_SECTION_ORDER,
      hidden_sections: updates.hidden_sections ?? DEFAULT_HIDDEN_SECTIONS,
    },
    { onConflict: 'profile_id' }
  );

  if (error) return { error: error.message };
  return {};
}

export async function updateSectionOrder(
  profileId: string,
  sectionOrder: string[]
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('profile_preferences')
    .upsert({ profile_id: profileId, section_order: sectionOrder }, { onConflict: 'profile_id' });

  if (error) return { error: error.message };
  return {};
}

export async function updateHiddenSections(
  profileId: string,
  hiddenSections: string[]
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('profile_preferences')
    .upsert(
      { profile_id: profileId, hidden_sections: hiddenSections },
      { onConflict: 'profile_id' }
    );

  if (error) return { error: error.message };
  return {};
}

export async function updateTemplate(
  profileId: string,
  templateKey: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('profile_preferences')
    .upsert({ profile_id: profileId, template_key: templateKey }, { onConflict: 'profile_id' });

  if (error) return { error: error.message };
  return {};
}

export async function updateAccent(
  profileId: string,
  accentKey: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('profile_preferences')
    .upsert({ profile_id: profileId, accent_key: accentKey }, { onConflict: 'profile_id' });

  if (error) return { error: error.message };
  return {};
}

export async function getPublicPreferences(profileId: string): Promise<ProfilePreferences | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_preferences')
    .select('template_key, accent_key, section_order, hidden_sections')
    .eq('profile_id', profileId)
    .single();

  if (error || !data) return null;

  return {
    id: "",
    profile_id: profileId,
    template_key: data.template_key || DEFAULT_TEMPLATE_KEY,
    accent_key: data.accent_key || DEFAULT_ACCENT_KEY,
    section_order: (data.section_order as string[]) || DEFAULT_SECTION_ORDER,
    hidden_sections: (data.hidden_sections as string[]) || DEFAULT_HIDDEN_SECTIONS,
  };
}

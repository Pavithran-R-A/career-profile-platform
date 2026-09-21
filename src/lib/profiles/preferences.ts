import { z } from "zod";
import { getSupabaseClient } from "../supabase/client";

export const ProfilePreferencesSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  is_public: z.boolean().default(false),
  published_at: z.string().datetime().nullable().optional(),
  custom_domain: z.string().nullable().optional(),
  template_id: z.string().default("minimal"),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ProfilePreferences = z.infer<typeof ProfilePreferencesSchema>;

export async function getProfilePreferences(profileId: string): Promise<ProfilePreferences | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profile_preferences")
    .select("*")
    .eq("profile_id", profileId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return ProfilePreferencesSchema.parse(data);
}

export async function publishProfile(profileId: string): Promise<ProfilePreferences> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profile_preferences")
    .upsert(
      {
        profile_id: profileId,
        is_public: true,
        published_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return ProfilePreferencesSchema.parse(data);
}

export async function unpublishProfile(profileId: string): Promise<ProfilePreferences> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profile_preferences")
    .upsert(
      {
        profile_id: profileId,
        is_public: false,
        published_at: null,
      },
      { onConflict: "profile_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return ProfilePreferencesSchema.parse(data);
}

export function checkDomainAvailability(domain: string): { available: boolean; reason?: string } {
  if (domain.length < 3) return { available: false, reason: "Domain too short" };
  if (domain.length > 253) return { available: false, reason: "Domain too long" };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(domain)) {
    return { available: false, reason: "Invalid domain format" };
  }
  const reserved = ["api", "www", "admin", "mail", "smtp", "ftp", "cdn", "static"];
  if (reserved.includes(domain)) return { available: false, reason: "Domain is reserved" };
  return { available: true };
}

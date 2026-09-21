import { z } from 'zod';
import { getSupabaseClient } from '../supabase/client';

const PublicProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string().nullable(),
  headline: z.string().nullable(),
  about: z.string().nullable(),
  location: z.string().nullable(),
  avatar_url: z.string().nullable(),
  username: z.string(),
  visibility: z.enum(['draft', 'published']),
  published_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export async function getPublicProfileByUserId(userId: string): Promise<PublicProfile | null> {
  const supabase = getSupabaseClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('visibility', 'published')
    .single();

  if (error || !profile) return null;

  return PublicProfileSchema.parse(profile);
}

export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  const supabase = getSupabaseClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('visibility', 'published')
    .single();

  if (error || !profile) return null;

  return PublicProfileSchema.parse(profile);
}

export async function getPublishedProfileUsernames(): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('visibility', 'published');

  if (error) throw error;
  return (data ?? []).map((p: { username: string }) => p.username).filter(Boolean);
}

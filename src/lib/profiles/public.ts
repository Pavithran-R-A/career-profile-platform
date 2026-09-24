import { z } from 'zod';
import { getSupabaseClient } from '../supabase/client';

/**
 * Public-safe profile shape. Mirrors the `public.public_profiles` view,
 * which is the only profile surface granted to anonymous users.
 * Note: no `user_id` — it is never exposed publicly.
 */
const PublicProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable(),
  headline: z.string().nullable(),
  about: z.string().nullable(),
  location: z.string().nullable(),
  avatar_url: z.string().nullable(),
  username: z.string(),
  visibility: z.enum(['draft', 'published']),
  // Supabase timestamptz values carry a numeric offset (+00:00), which
  // zod only accepts with `offset: true`.
  published_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type PublicProfile = z.infer<typeof PublicProfileSchema>;

/**
 * Authenticated-owner lookup. The base `profiles` table is granted to
 * authenticated users only; anonymous callers must use the username
 * lookup below, which reads the anon-safe view.
 */
export async function getPublicProfileByUserId(userId: string): Promise<PublicProfile | null> {
  const supabase = getSupabaseClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, headline, about, location, avatar_url, username, visibility, published_at, created_at, updated_at'
    )
    .eq('user_id', userId)
    .eq('visibility', 'published')
    .maybeSingle();

  if (error || !profile) return null;

  return PublicProfileSchema.parse(profile);
}

/** Anonymous-safe: reads the `public_profiles` view (granted to anon). */
export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  const supabase = getSupabaseClient();

  const { data: profile, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error || !profile) return null;

  return PublicProfileSchema.parse(profile);
}

/** Anonymous-safe: reads the `public_profiles` view (granted to anon). */
export async function getPublishedProfileUsernames(): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.from('public_profiles').select('username');

  if (error) throw error;
  return (data ?? [])
    .map((p: { username: string | null }) => p.username)
    .filter((username): username is string => !!username);
}

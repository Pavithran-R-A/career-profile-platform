import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  client = createClient<Database>(supabaseUrl, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return client;
}

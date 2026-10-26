import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function createServerClient(
  supabaseUrl: string,
  serviceRoleKey: string
): ReturnType<typeof createClient<Database>> {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

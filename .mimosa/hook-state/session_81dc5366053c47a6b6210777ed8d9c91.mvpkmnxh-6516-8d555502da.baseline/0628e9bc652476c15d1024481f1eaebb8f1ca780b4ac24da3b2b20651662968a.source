import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function validateClientEnv(raw: Record<string, unknown>): ClientEnv {
  return clientEnvSchema.parse(raw);
}

export function validateServerEnv(raw: Record<string, unknown>): ServerEnv {
  return serverEnvSchema.parse(raw);
}

/**
 * src/auth/supabase.ts
 *
 * Conditional Supabase client. Returns a configured SupabaseClient when both
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present in the environment,
 * or null when they are absent.
 *
 * The anon key is a public row-level-security key — it is safe to expose in
 * the browser. The service-role key must NEVER be imported here. All data
 * access is enforced by Postgres RLS policies (auth.uid() = user_id).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * True when Supabase credentials are configured in the environment.
 * When false the app operates in local-only anonymous mode.
 */
export const isSupabaseConfigured: boolean =
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.length > 0 &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.length > 0

/**
 * The Supabase client singleton, or null in local-only mode.
 * Components should always check `isSupabaseConfigured` before using this.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : null

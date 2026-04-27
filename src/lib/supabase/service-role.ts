import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente admin com service_role. NUNCA usar fora de server actions/route handlers.
 * Não tem RLS — bypassa todas as policies. Usar só para operações privilegiadas
 * (criar usuário, etc.).
 */
export function createServiceRoleClient() {
  const serverEnv = getServerEnv();
  return createSupabaseClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

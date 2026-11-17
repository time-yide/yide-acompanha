import { createBrowserClient } from "@supabase/ssr";
import { publicEnv as env } from "@/lib/env-public";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

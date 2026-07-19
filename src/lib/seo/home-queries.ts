import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { mergeHomeConfig, type HomeConfig } from "./home-config";
export async function getHomeConfig(orgId: string): Promise<HomeConfig> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = createServiceRoleClient();
  try {
    const { data } = await sb.from("home_config").select("dados").eq("organization_id", orgId).maybeSingle();
    return mergeHomeConfig((data?.dados as Record<string, unknown>) ?? null);
  } catch { return mergeHomeConfig(null); }
}

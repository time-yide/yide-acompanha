import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

export async function incrementLeadScore(leadGeradoId: string, points: number): Promise<void> {
  const { data } = await sb()
    .from("leads_gerados")
    .select("score")
    .eq("id", leadGeradoId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentScore = (data as any)?.score ?? 0;
  await sb()
    .from("leads_gerados")
    .update({ score: currentScore + points })
    .eq("id", leadGeradoId);
}

"use server";

import { requireAuth } from "@/lib/auth/session";
import { getBatidasTimeline, type BatidaTimelineItem } from "@/lib/batidas/queries";

export async function carregarTimelineAction(input: {
  leadGeradoId: string | null;
  leadId: string | null;
  visitaId: string | null;
  visitaData: string | null;
}): Promise<BatidaTimelineItem[]> {
  await requireAuth();
  return getBatidasTimeline(input);
}

// src/lib/instagram-snapshots/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchProfileSnapshot } from "./scraper";
import { getSnapshotSeRecente } from "./queries";
import { isPacoteElegivel } from "./tipos";

type ActionErr = { error: string };
export interface RefreshResult {
  refreshed: number;
  cached: number;
  errors: number;
  total: number;
}

const CACHE_MASSA_MS = 60 * 60 * 1000;     // 1h
const CACHE_INDIVIDUAL_MS = 5 * 60 * 1000;  // 5min

const ROLES_PERMITIDOS = ["socio", "adm", "coordenador", "assessor"];

/**
 * Refresh sob demanda. Pode ser chamado com 1 ou N clientIds. Usa cache:
 * - Single (1 client): 5min
 * - Massa (N clients): 1h
 *
 * Sócio/adm/coordenador podem refresh qualquer cliente. Assessor só os
 * onde `assessor_id = self`.
 */
export async function refreshSnapshotsAction(
  clientIds: string[],
): Promise<ActionErr | RefreshResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }
  if (clientIds.length === 0) {
    return { refreshed: 0, cached: 0, errors: 0, total: 0 };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Busca metadados dos clientes (pacote, URL, assessor) pra validar.
  const { data: clientesRaw } = await sb
    .from("clients")
    .select("id, organization_id, tipo_pacote, instagram_url, assessor_id")
    .in("id", clientIds);
  const clientes = (clientesRaw ?? []) as Array<{
    id: string;
    organization_id: string;
    tipo_pacote: string;
    instagram_url: string | null;
    assessor_id: string | null;
  }>;

  // Filtra:
  // - Assessor: só clientes onde assessor_id = self
  // - Todos: só pacotes elegíveis
  // - Todos: só com instagram_url cadastrado
  const elegiveis = clientes.filter((c) => {
    if (!isPacoteElegivel(c.tipo_pacote)) return false;
    if (!c.instagram_url) return false;
    if (actor.role === "assessor" && c.assessor_id !== actor.id) return false;
    return true;
  });

  const cacheMs = clientIds.length === 1 ? CACHE_INDIVIDUAL_MS : CACHE_MASSA_MS;
  let refreshed = 0, cached = 0, errors = 0;

  // Roda em batches de 5 paralelos pra não estourar Apify rate limit.
  const batchSize = 5;
  for (let i = 0; i < elegiveis.length; i += batchSize) {
    const batch = elegiveis.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (c) => {
        const recente = await getSnapshotSeRecente(c.id, cacheMs);
        if (recente) return "cached" as const;

        const snap = await fetchProfileSnapshot(c.instagram_url);

        const { error } = await sb.from("client_instagram_snapshots").insert({
          client_id: c.id,
          organization_id: c.organization_id,
          total_posts: snap.totalPosts,
          recent_posts: snap.recentPosts,
          scrape_status: snap.status,
          erro: snap.erro ?? null,
          triggered_by: actor.id,
        });
        if (error) return "error" as const;
        return snap.status === "ok" ? "refreshed" : "error";
      }),
    );
    for (const r of results) {
      if (r === "cached") cached++;
      else if (r === "refreshed") refreshed++;
      else errors++;
    }
  }

  revalidatePath("/");
  return { refreshed, cached, errors, total: elegiveis.length };
}

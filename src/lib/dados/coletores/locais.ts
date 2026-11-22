// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listPublicadosYideEcom } from "@/lib/ecommerce/yideecom";
import { normalizarNome } from "@/lib/ecommerce/yideecom-match";
import type { Periodo } from "../tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createServiceRoleClient() as any;

/** Total de avaliações no começo do período (snapshot mais próximo antes de `de`). */
export async function avaliacoesGmnNoInicio(clientId: string, p: Periodo): Promise<number | null> {
  const { data } = await sb()
    .from("client_gmb_snapshots")
    .select("review_count")
    .eq("client_id", clientId)
    .lte("captured_at", `${p.de}T23:59:59-03:00`)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { review_count: number | null } | null)?.review_count ?? null;
}

/** Anúncios publicados (manuais + Yide Ecom) no período e no anterior.
 * Yide Ecom identifica o cliente pelo nome (mesmo critério de casarPublicados em /ecommerce). */
export async function contarAnunciosEcommerce(clientId: string, clientNome: string, atual: Periodo, anterior: Periodo) {
  const contarManuais = async (p: Periodo) => {
    const { data } = await sb()
      .from("anuncios_ecommerce").select("quantidade")
      .eq("client_id", clientId).is("arquivado_em", null)
      .gte("data", p.de).lte("data", p.ate);
    return ((data ?? []) as Array<{ quantidade: number }>).reduce((s, r) => s + r.quantidade, 0);
  };
  const [m1, m2, ecom] = await Promise.all([contarManuais(atual), contarManuais(anterior), listPublicadosYideEcom(anterior.de, atual.ate)]);
  let e1 = 0, e2 = 0;
  if (ecom.ok) {
    const alvo = normalizarNome(clientNome);
    for (const pub of ecom.publicados) {
      if (normalizarNome(pub.cliente_nome) !== alvo) continue;
      if (pub.data >= atual.de && pub.data <= atual.ate) e1 += pub.quantidade;
      else if (pub.data >= anterior.de && pub.data <= anterior.ate) e2 += pub.quantidade;
    }
  }
  return { anuncios: m1 + e1, anunciosAnt: m2 + e2 };
}

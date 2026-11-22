// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listPublicadosYideEcom, type YideEcomResultado } from "@/lib/ecommerce/yideecom";
import { normalizarNome, type PublicadoYideEcom } from "@/lib/ecommerce/yideecom-match";
import type { Periodo } from "../tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createServiceRoleClient() as any;

/** Total de avaliações no começo do período (snapshot mais próximo antes de `de`). */
export async function avaliacoesGmnNoInicio(clientId: string, p: Periodo): Promise<number | null> {
  const { data } = await sb()
    .from("client_gmb_snapshots")
    .select("review_count")
    .eq("client_id", clientId)
    .lte("captured_at", `${p.de}T00:00:00-03:00`)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { review_count: number | null } | null)?.review_count ?? null;
}

const TTL_MS = 5 * 60_000;
function memo<T>(cache: Map<string, { exp: number; p: Promise<T> }>, key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.p;
  if (hit) cache.delete(key);
  const p = fn();
  cache.set(key, { exp: Date.now() + TTL_MS, p });
  return p;
}
const cachePublicados = new Map<string, { exp: number; p: Promise<YideEcomResultado<PublicadoYideEcom[]>> }>();
/** Uma chamada ao Yide Ecom por (de|ate), reaproveitada por ~5 min (um cron = 1 chamada). */
const publicadosMemo = (de: string, ate: string) =>
  memo(cachePublicados, `${de}|${ate}`, () => listPublicadosYideEcom(de, ate));

const cacheNomes = new Map<string, { exp: number; p: Promise<string[]> }>();
const nomesEcommerceDaOrg = (orgId: string) =>
  memo(cacheNomes, orgId, async () => {
    const { data } = await sb().from("clients").select("nome").eq("organization_id", orgId).eq("tipo_pacote", "ecommerce");
    return ((data ?? []) as Array<{ nome: string }>).map((c) => normalizarNome(c.nome));
  });

/**
 * Anúncios publicados (manuais + Yide Ecom) no período e no anterior.
 * Yide Ecom identifica o cliente pelo nome (mesmo critério de casarPublicados em /ecommerce).
 * Retorna null se o Yide Ecom estiver fora do ar (não punir o cliente por falha nossa).
 * Se outro cliente e-commerce da org tem o mesmo nome normalizado, só conta os manuais.
 */
export async function contarAnunciosEcommerce(clientId: string, orgId: string, clientNome: string, atual: Periodo, anterior: Periodo) {
  const contarManuais = async (p: Periodo) => {
    const { data } = await sb()
      .from("anuncios_ecommerce").select("quantidade")
      .eq("client_id", clientId).is("arquivado_em", null)
      .gte("data", p.de).lte("data", p.ate);
    return ((data ?? []) as Array<{ quantidade: number }>).reduce((s, r) => s + r.quantidade, 0);
  };
  const [m1, m2, ecom, nomes] = await Promise.all([
    contarManuais(atual), contarManuais(anterior), publicadosMemo(anterior.de, atual.ate), nomesEcommerceDaOrg(orgId),
  ]);
  if (!ecom.ok) return null;
  const alvo = normalizarNome(clientNome);
  const ambiguo = nomes.filter((n) => n === alvo).length > 1;
  let e1 = 0, e2 = 0;
  if (!ambiguo) {
    for (const pub of ecom.dados) {
      if (normalizarNome(pub.cliente_nome) !== alvo) continue;
      if (pub.data >= atual.de && pub.data <= atual.ate) e1 += pub.quantidade;
      else if (pub.data >= anterior.de && pub.data <= anterior.ate) e2 += pub.quantidade;
    }
  }
  return { anuncios: m1 + e1, anunciosAnt: m2 + e2 };
}

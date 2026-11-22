// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ga4Cache, gscCache, lyideCache, metaContasCache, metaPaginasCache } from "../opcoes-conexao";
import { idsUsados, sugerirConexoes, type ClienteConexao, type FontesConexao } from "./matching";
import type { ResultadoSugestoes } from "./tipos";

const COLS = "id, nome, status, instagram_url, instagram_business_id, facebook_page_id, meta_ad_account_id, " +
  "ga4_property_id, gsc_site_url, crm_tipo, crm_identifier";

/** Procura, pra cada cliente ativo/onboarding da organização, as contas externas que batem (só campos vazios). */
export async function sugerirConexoesOrg(orgId: string): Promise<ResultadoSugestoes> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const [clientesRes, paginas, contas, ga4, gsc, lyide] = await Promise.all([
    sb.from("clients").select(COLS).eq("organization_id", orgId).is("deleted_at", null),
    metaPaginasCache().catch(() => null),
    metaContasCache().catch(() => null),
    ga4Cache().catch(() => null),
    gscCache().catch(() => null),
    lyideCache().catch(() => null),
  ]);
  if (clientesRes.error) throw new Error(`[dados/auto-conectar] clients ${clientesRes.error.message}`);
  const todos = (clientesRes.data ?? []) as Array<ClienteConexao & { status: string }>;
  const ativos = todos.filter((c) => c.status === "ativo" || c.status === "em_onboarding");

  const fontes: FontesConexao = { paginas, contas, ga4, gsc, lyide };
  const sugestoes = sugerirConexoes(ativos, fontes, idsUsados(todos))
    .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, "pt-BR"));
  return {
    sugestoes,
    fontes: { meta: paginas != null, anuncios: contas != null, ga4: ga4 != null, gsc: gsc != null, lyide: lyide != null },
  };
}

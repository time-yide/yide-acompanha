// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { avaliarAnuncios, avaliarCrm, avaliarEcommerce, avaliarGmn, avaliarGoogle, avaliarRede, avaliarSite } from "./regras";
import { calcularNota, listarPerdas } from "./nota";
import { periodoAnterior, periodoPadrao } from "./periodo";
import { coletarGa4, coletarGsc } from "./coletores/google";
import { coletarAnuncios, coletarFacebook, coletarInstagram } from "./coletores/meta";
import { coletarCrmLyide } from "./coletores/lyide";
import { avaliacoesGmnNoInicio, contarAnunciosEcommerce } from "./coletores/locais";
import type { CanaisResultado, Periodo, SnapshotDados } from "./tipos";

export const CLIENTE_DADOS_SELECT =
  "id, organization_id, nome, website, instagram_url, instagram_business_id, facebook_page_id, meta_ad_account_id, " +
  "gmb_place_id, gmb_link, gmb_rating, gmb_review_count, crm_tipo, crm_identifier, tipo_pacote, ga4_property_id, gsc_site_url";

export interface ClienteDados {
  id: string; organization_id: string; nome: string; website: string | null;
  instagram_url: string | null; instagram_business_id: string | null; facebook_page_id: string | null;
  meta_ad_account_id: string | null; gmb_place_id: string | null; gmb_link: string | null;
  gmb_rating: number | null; gmb_review_count: number | null; crm_tipo: string | null;
  crm_identifier: string | null; tipo_pacote: string | null; ga4_property_id: string | null; gsc_site_url: string | null;
}

function addDias(ymd: string, n: number): string {
  return new Date(new Date(`${ymd}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}
const ultimos7 = (p: Periodo): Periodo => ({ de: addDias(p.ate, -6), ate: p.ate });

export async function calcularCliente(c: ClienteDados, periodo: Periodo = periodoPadrao(), agora = new Date()): Promise<SnapshotDados> {
  const ant = periodoAnterior(periodo);
  const temSite = !!c.website?.trim();
  const [ga4, gsc, ig, fb, ads, crm, gmnIni, ecom] = await Promise.all([
    temSite && c.ga4_property_id ? coletarGa4(c.ga4_property_id, periodo, ant) : null,
    temSite && c.gsc_site_url ? coletarGsc(c.gsc_site_url, periodo, ant) : null,
    c.instagram_business_id ? coletarInstagram(c.instagram_business_id, periodo) : null,
    c.facebook_page_id ? coletarFacebook(c.facebook_page_id, periodo) : null,
    c.meta_ad_account_id ? coletarAnuncios(c.meta_ad_account_id, periodo, ultimos7(periodo)) : null,
    c.crm_tipo === "yide" && c.crm_identifier ? coletarCrmLyide(c.crm_identifier, periodo) : null,
    c.gmb_place_id || c.gmb_link ? avaliacoesGmnNoInicio(c.id, periodo) : null,
    c.tipo_pacote === "ecommerce" ? contarAnunciosEcommerce(c.id, c.organization_id, c.nome, periodo, ant) : null,
  ]);

  const canais: CanaisResultado = {
    site: avaliarSite({ temSite, dados: ga4 }),
    google: avaliarGoogle({ temSite, dados: gsc }),
    gmn: avaliarGmn({ temPerfil: !!(c.gmb_place_id || c.gmb_link), nota: c.gmb_rating, avaliacoes: c.gmb_review_count, avaliacoesAnt: gmnIni }),
    instagram: avaliarRede("Instagram", { temPerfil: !!(c.instagram_url || c.instagram_business_id), dados: ig }, agora),
    facebook: avaliarRede("Facebook", { temPerfil: !!c.facebook_page_id, dados: fb }, agora),
    anuncios: avaliarAnuncios({ temConta: !!c.meta_ad_account_id, dados: ads }),
    ecommerce: avaliarEcommerce({ aplica: c.tipo_pacote === "ecommerce", dados: ecom }),
    crm: avaliarCrm({ crmTipo: c.crm_tipo, dados: crm }),
  };
  return { nota: calcularNota(canais), canais, perdas: listarPerdas(canais) };
}

/** Calcula e grava (1 linha por cliente+periodo_fim; re-execução atualiza). `nota_anterior` = nota do snapshot de ~30 dias atrás. Lança em erro de banco. */
export async function salvarSnapshot(c: ClienteDados): Promise<SnapshotDados> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const periodo = periodoPadrao();
  const snap = await calcularCliente(c, periodo);
  const { data: ultimo, error: errUltimo } = await sb.from("client_dados_snapshots").select("nota")
    .eq("client_id", c.id).lt("calculado_em", new Date(Date.now() - 29 * 86_400_000).toISOString())
    .order("calculado_em", { ascending: false }).limit(1).maybeSingle();
  if (errUltimo) throw new Error(`[dados/salvarSnapshot] leitura: ${errUltimo.message}`);
  const { error } = await sb.from("client_dados_snapshots").upsert({
    organization_id: c.organization_id, client_id: c.id,
    periodo_inicio: periodo.de, periodo_fim: periodo.ate,
    nota: snap.nota, nota_anterior: (ultimo as { nota: number | null } | null)?.nota ?? null,
    canais: snap.canais, perdas: snap.perdas, calculado_em: new Date().toISOString(),
  }, { onConflict: "client_id,periodo_fim" });
  if (error) throw new Error(`[dados/salvarSnapshot] gravação: ${error.message}`);
  return snap;
}

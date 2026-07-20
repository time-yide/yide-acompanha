// src/lib/trafego/relatorios/meta-fetch.ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAccountInsights, getTopCampaigns, getAccountDailyInsights } from "@/lib/trafego/meta-api";
import type { DadosTrafego } from "./tipos";

export interface MetaFetchResult {
  ok: boolean;
  /** Quando ok=false: 'no_account' = cliente sem meta_ad_account_id; 'api_error' = Meta falhou. */
  motivo?: "no_account" | "api_error";
  dados?: DadosTrafego;
  erroDetalhe?: string;
}

export async function fetchDadosMeta(
  clienteId: string,
  inicio: string,
  fim: string,
): Promise<MetaFetchResult> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: client } = await sb
    .from("clients")
    .select("meta_ad_account_id")
    .eq("id", clienteId)
    .single();

  const accountId = (client as { meta_ad_account_id: string | null } | null)?.meta_ad_account_id;
  if (!accountId) return { ok: false, motivo: "no_account" };

  try {
    const dados = await fetchInsightsRange(accountId, inicio, fim);

    // Série diária pro gráfico de evolução (não quebra se a API falhar aqui).
    const serie = await getAccountDailyInsights(accountId, inicio, fim).catch(() => []);

    // Período anterior de mesma duração, imediatamente antes.
    const duracaoMs = new Date(fim).getTime() - new Date(inicio).getTime();
    const anteriorFim = new Date(new Date(inicio).getTime() - 86400_000);
    const anteriorInicio = new Date(anteriorFim.getTime() - duracaoMs);
    const anterior = await fetchInsightsRange(
      accountId,
      anteriorInicio.toISOString().slice(0, 10),
      anteriorFim.toISOString().slice(0, 10),
    ).catch(() => null);

    return {
      ok: true,
      dados: {
        ...dados,
        serie_diaria: serie.length > 0
          ? serie.map((p) => ({ data: p.data, spend: p.spend, resultados: p.resultados }))
          : undefined,
        periodo_anterior: anterior ? {
          spend: anterior.spend,
          cliques: anterior.cliques,
          conversoes: anterior.conversoes,
          leads: anterior.leads,
        } : undefined,
      },
    };
  } catch (e) {
    return { ok: false, motivo: "api_error", erroDetalhe: (e as Error).message };
  }
}

async function fetchInsightsRange(
  accountId: string,
  inicio: string,
  fim: string,
): Promise<DadosTrafego> {
  const insights = await getAccountInsights(accountId, inicio, fim);
  const top = await getTopCampaigns(accountId, inicio, fim, 5).catch(() => []);
  return {
    spend: insights.spend ?? 0,
    impressoes: insights.impressions,
    alcance: insights.reach,
    cliques: insights.clicks,
    cpc: insights.cpc,
    ctr: insights.ctr,
    conversoes: insights.conversions,
    custo_por_conversao: insights.cost_per_conversion,
    leads: insights.leads,
    custo_por_lead: insights.cost_per_lead,
    top_campanhas: top.map((c) => ({ nome: c.name, spend: c.spend, resultados: c.results })),
  };
}

// SERVER ONLY — agrega métricas de Tráfego (anúncios) de um cliente num período,
// direto da tabela trafego_metricas_diarias (sync do Meta). Determinístico.
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface DadosTrafegoRelatorio {
  spend: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  conversoes: number;
  leads: number;
  cpc: number;
  ctr: number;
  custo_por_lead: number;
  custo_por_conversao: number;
  top_campanhas: Array<{ nome: string; spend: number; resultados: number }>;
}

export interface MetricaTrafegoRaw {
  campanha_id: string;
  metrica_key: string;
  valor: number;
}

const KEY_MAP: Record<string, keyof Pick<DadosTrafegoRelatorio, "spend" | "impressoes" | "alcance" | "cliques" | "conversoes" | "leads">> = {
  spend: "spend",
  impressions: "impressoes",
  reach: "alcance",
  clicks: "cliques",
  conversions: "conversoes",
  leads: "leads",
};

/** Agregação pura (testável). */
export function agregarTrafego(
  campanhas: Array<{ id: string; nome: string }>,
  metricasRows: MetricaTrafegoRaw[],
): DadosTrafegoRelatorio {
  const totais = { spend: 0, impressoes: 0, alcance: 0, cliques: 0, conversoes: 0, leads: 0 };
  const porCampanha = new Map<string, { spend: number; resultados: number }>();
  const nomePorId = new Map(campanhas.map((c) => [c.id, c.nome]));

  for (const r of metricasRows) {
    const k = KEY_MAP[r.metrica_key];
    const v = Number(r.valor) || 0;
    if (k) totais[k] += v;
    const c = porCampanha.get(r.campanha_id) ?? { spend: 0, resultados: 0 };
    if (r.metrica_key === "spend") c.spend += v;
    if (r.metrica_key === "conversions" || r.metrica_key === "leads") c.resultados += v;
    porCampanha.set(r.campanha_id, c);
  }

  const cpc = totais.cliques > 0 ? totais.spend / totais.cliques : 0;
  const ctr = totais.impressoes > 0 ? (totais.cliques / totais.impressoes) * 100 : 0;
  const custo_por_lead = totais.leads > 0 ? totais.spend / totais.leads : 0;
  const custo_por_conversao = totais.conversoes > 0 ? totais.spend / totais.conversoes : 0;

  const top_campanhas = [...porCampanha.entries()]
    .map(([id, v]) => ({ nome: nomePorId.get(id) ?? "Campanha", spend: v.spend, resultados: v.resultados }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  return { ...totais, cpc, ctr, custo_por_lead, custo_por_conversao, top_campanhas };
}

/** Busca + agrega o Tráfego de um cliente no período (datas YYYY-MM-DD). */
export async function montarDadosTrafego(
  clienteId: string,
  inicio: string,
  fim: string,
): Promise<DadosTrafegoRelatorio> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: camps } = await sbAny
    .from("trafego_campanhas")
    .select("id, nome")
    .eq("client_id", clienteId)
    .is("archived_at", null);
  const campanhas = (camps ?? []) as Array<{ id: string; nome: string }>;
  if (campanhas.length === 0) return agregarTrafego([], []);

  const ids = campanhas.map((c) => c.id);
  const { data: mets } = await sbAny
    .from("trafego_metricas_diarias")
    .select("campanha_id, metrica_key, valor_numerico")
    .in("campanha_id", ids)
    .gte("data", inicio)
    .lte("data", fim);

  const metricasRows: MetricaTrafegoRaw[] = (
    (mets ?? []) as Array<{ campanha_id: string; metrica_key: string; valor_numerico: number }>
  ).map((m) => ({ campanha_id: m.campanha_id, metrica_key: m.metrica_key, valor: Number(m.valor_numerico) || 0 }));

  return agregarTrafego(campanhas, metricasRows);
}

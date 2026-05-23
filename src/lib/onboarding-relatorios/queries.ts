// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PeriodKey = "este_mes" | "mes_passado" | "ultimos_3_meses" | "este_ano";

const PERIOD_KEYS: readonly PeriodKey[] = [
  "este_mes",
  "mes_passado",
  "ultimos_3_meses",
  "este_ano",
];

export function isValidPeriodKey(s: unknown): s is PeriodKey {
  return typeof s === "string" && (PERIOD_KEYS as readonly string[]).includes(s);
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  este_mes: "Este mês",
  mes_passado: "Mês passado",
  ultimos_3_meses: "Últimos 3 meses",
  este_ano: "Este ano",
};

/** Retorna [from, to] em UTC. `to` é o último dia (23:59:59) do range. */
export function periodToRange(period: PeriodKey): { from: Date; to: Date } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (period) {
    case "este_mes":
      return {
        from: new Date(Date.UTC(y, m, 1)),
        to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
      };
    case "mes_passado":
      return {
        from: new Date(Date.UTC(y, m - 1, 1)),
        to: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
      };
    case "ultimos_3_meses":
      return {
        from: new Date(Date.UTC(y, m - 2, 1)),
        to: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
      };
    case "este_ano":
      return {
        from: new Date(Date.UTC(y, 0, 1)),
        to: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      };
  }
}

/** Número de meses no range - usado pra multiplicar gasto mensal de tráfego. */
function monthsInRange(period: PeriodKey): number {
  switch (period) {
    case "este_mes":
    case "mes_passado":
      return 1;
    case "ultimos_3_meses":
      return 3;
    case "este_ano": {
      // Conta meses já decorridos no ano corrente.
      return new Date().getUTCMonth() + 1;
    }
  }
}

export interface MetricCards {
  cpl: number | null;
  cac: number | null;
  conversao: number | null;
  roi: number | null;
  ticket_medio: number | null;
}

interface RawCounts {
  gasto: number;
  leadsGerados: number;
  vendasFechadas: number;
  valorVendas: number;
}

export function computeMetricas(c: RawCounts): MetricCards {
  return {
    cpl: c.leadsGerados > 0 ? c.gasto / c.leadsGerados : null,
    cac: c.vendasFechadas > 0 ? c.gasto / c.vendasFechadas : null,
    conversao: c.leadsGerados > 0 ? (c.vendasFechadas / c.leadsGerados) * 100 : null,
    roi: c.gasto > 0 ? ((c.valorVendas - c.gasto) / c.gasto) * 100 : null,
    ticket_medio: c.vendasFechadas > 0 ? c.valorVendas / c.vendasFechadas : null,
  };
}

export interface FunilStep {
  key:
    | "gasto_total"
    | "leads_pagos"
    | "leads_organicos"
    | "leads_gerados"
    | "reunioes"
    | "vendas_fechadas"
    | "valor_vendas";
  label: string;
  valor: number;
  formato: "moeda" | "numero";
  placeholder?: boolean;
}

export interface RelatorioData {
  funil: FunilStep[];
  metricas: MetricCards;
  period: { from: Date; to: Date };
  periodKey: PeriodKey;
}

export async function getOnboardingRelatorios(
  period: PeriodKey,
): Promise<RelatorioData> {
  const range = periodToRange(period);
  const months = monthsInRange(period);

  const admin = createServiceRoleClient();

  // 1. Gasto total - soma dos valores mensais de tráfego dos clientes ativos,
  //    multiplicada pelo número de meses do período.
  const { data: clientsData } = await admin
    .from("clients")
    .select("valor_trafego_google, valor_trafego_meta")
    .eq("status", "ativo")
    .is("deleted_at", null);
  const clients = (clientsData ?? []) as Array<{
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
  }>;
  const gastoMensal = clients.reduce(
    (acc, c) => acc + Number(c.valor_trafego_google ?? 0) + Number(c.valor_trafego_meta ?? 0),
    0,
  );
  const gastoTotal = gastoMensal * months;

  // 2. Leads gerados.
  const { count: leadsGeradosCount } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString());
  const leadsGerados = leadsGeradosCount ?? 0;

  // 3. Reuniões realizadas - depende do módulo reuniões maturar. Por enquanto
  //    o módulo está em Fase 0 (mock data, sem tabela `meetings` no schema),
  //    então retornamos 0 e marcamos como placeholder no funil. Quando Fase 1
  //    entrar, basta substituir por SELECT real em `meetings`.
  const reunioes = 0;

  // 4. Vendas fechadas + valor - leads que viraram cliente no período.
  const { data: vendasData } = await admin
    .from("leads")
    .select("valor_proposto")
    .eq("stage", "ativo")
    .gte("data_fechamento", range.from.toISOString().slice(0, 10))
    .lte("data_fechamento", range.to.toISOString().slice(0, 10));
  const vendas = (vendasData ?? []) as Array<{ valor_proposto: number | null }>;
  const vendasFechadas = vendas.length;
  const valorVendas = vendas.reduce((acc, v) => acc + Number(v.valor_proposto ?? 0), 0);

  const funil: FunilStep[] = [
    { key: "gasto_total", label: "Gasto total", valor: gastoTotal, formato: "moeda" },
    { key: "leads_pagos", label: "Leads pagos", valor: 0, formato: "numero", placeholder: true },
    { key: "leads_organicos", label: "Leads orgânicos", valor: 0, formato: "numero", placeholder: true },
    { key: "leads_gerados", label: "Leads gerados", valor: leadsGerados, formato: "numero" },
    { key: "reunioes", label: "Reuniões realizadas", valor: reunioes, formato: "numero", placeholder: reunioes === 0 },
    { key: "vendas_fechadas", label: "Vendas fechadas", valor: vendasFechadas, formato: "numero" },
    { key: "valor_vendas", label: "Valor em vendas", valor: valorVendas, formato: "moeda" },
  ];

  const metricas = computeMetricas({
    gasto: gastoTotal,
    leadsGerados,
    vendasFechadas,
    valorVendas,
  });

  return { funil, metricas, period: range, periodKey: period };
}

// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import { isInMonth, monthRange, lastDayOfMonth } from "./date-utils";

interface ClientRow {
  id: string;
  valor_mensal: number;
  data_entrada: string;
  data_churn: string | null;
  status: string;
}

export interface KpiData {
  carteiraAtiva: { valor: number; deltaValor: number };
  clientesAtivos: { quantidade: number; deltaQuantidade: number };
  churnMes: { quantidade: number; valorPerdido: number };
  custoComissaoPct: { pct: number };
}

function isActiveOn(c: ClientRow, dateIso: string): boolean {
  // Cliente está ativo no dia X se entrou até X e (não churnou OU churnou depois de X)
  if (c.data_entrada > dateIso) return false;
  if (c.data_churn && c.data_churn <= dateIso) return false;
  return true;
}

export async function getKpis(now: Date = new Date()): Promise<KpiData> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const todayIso = now.toISOString().slice(0, 10);

  // Calcular última data do mês ANTERIOR (para delta)
  const prevMonthLastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn, status")
    .eq("status", "ativo");

  const allClients = (clientsData ?? []) as ClientRow[];

  const ativosHoje = allClients.filter((c) => isActiveOn(c, todayIso));
  const ativosFimMesAnterior = allClients.filter((c) => isActiveOn(c, prevMonthLastDay));

  const carteiraAtivaValor = ativosHoje.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
  const carteiraMesAnteriorValor = ativosFimMesAnterior.reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  const churnsDoMes = allClients.filter((c) => isInMonth(c.data_churn, monthRef));
  const valorChurnado = churnsDoMes.reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  // Custo de comissão = soma do último commission_snapshot dividida pela carteira ativa
  const { data: snapshotsData } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia, valor_total")
    .order("mes_referencia", { ascending: false })
    .limit(50); // pega vários do mesmo mês mais recente
  const snapshots = (snapshotsData ?? []) as Array<{ mes_referencia: string; valor_total: number }>;
  const ultimoMes = snapshots[0]?.mes_referencia;
  const totalComissao = ultimoMes
    ? snapshots.filter((s) => s.mes_referencia === ultimoMes).reduce((a, s) => a + Number(s.valor_total), 0)
    : 0;
  const pctComissao = carteiraAtivaValor > 0 ? (totalComissao / carteiraAtivaValor) * 100 : 0;

  return {
    carteiraAtiva: {
      valor: carteiraAtivaValor,
      deltaValor: carteiraAtivaValor - carteiraMesAnteriorValor,
    },
    clientesAtivos: {
      quantidade: ativosHoje.length,
      deltaQuantidade: ativosHoje.length - ativosFimMesAnterior.length,
    },
    churnMes: {
      quantidade: churnsDoMes.length,
      valorPerdido: valorChurnado,
    },
    custoComissaoPct: {
      pct: pctComissao,
    },
  };
}

export interface TimelinePoint {
  mes: string;          // 'YYYY-MM'
  valorTotal: number;
}

export async function getCarteiraTimeline(
  months: number = 12,
  now: Date = new Date(),
): Promise<TimelinePoint[]> {
  const supabase = await createClient();
  const meses = monthRange(months, now);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn");

  const clients = (clientsData ?? []) as Array<{
    id: string;
    valor_mensal: number;
    data_entrada: string;
    data_churn: string | null;
  }>;

  return meses.map((mes) => {
    const fimDoMes = lastDayOfMonth(mes);
    const ativos = clients.filter((c) => {
      if (c.data_entrada > fimDoMes) return false;
      if (c.data_churn && c.data_churn <= fimDoMes) return false;
      return true;
    });
    const valorTotal = ativos.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
    return { mes, valorTotal };
  });
}

export interface EntradaChurnPoint {
  mes: string;
  entradas: number;
  churns: number;
}

export async function getEntradaChurn(
  months: number = 6,
  now: Date = new Date(),
): Promise<EntradaChurnPoint[]> {
  const supabase = await createClient();
  const meses = monthRange(months, now);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, data_entrada, data_churn");

  const clients = (clientsData ?? []) as Array<{
    id: string;
    data_entrada: string;
    data_churn: string | null;
  }>;

  return meses.map((mes) => {
    const entradas = clients.filter((c) => isInMonth(c.data_entrada, mes)).length;
    const churns = clients.filter((c) => isInMonth(c.data_churn, mes)).length;
    return { mes, entradas, churns };
  });
}

export interface AssessorCarteira {
  assessorId: string;
  assessorNome: string;
  qtdClientes: number;
  valorTotal: number;
  pctDoTotal: number;
}

export async function getCarteiraPorAssessor(): Promise<AssessorCarteira[]> {
  const supabase = await createClient();

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, assessor_id, assessor:profiles!clients_assessor_id_fkey(nome)")
    .eq("status", "ativo");

  const clients = (clientsData ?? []) as unknown as Array<{
    id: string;
    valor_mensal: number;
    assessor_id: string | null;
    assessor: { nome: string } | null;
  }>;

  // Agrupa por assessor_id
  const groups = new Map<string, { nome: string; qtd: number; valor: number }>();
  for (const c of clients) {
    if (!c.assessor_id || !c.assessor) continue;
    const cur = groups.get(c.assessor_id) ?? { nome: c.assessor.nome, qtd: 0, valor: 0 };
    cur.qtd += 1;
    cur.valor += Number(c.valor_mensal);
    groups.set(c.assessor_id, cur);
  }

  const total = [...groups.values()].reduce((a, g) => a + g.valor, 0);

  const list: AssessorCarteira[] = [...groups.entries()].map(([id, g]) => ({
    assessorId: id,
    assessorNome: g.nome,
    qtdClientes: g.qtd,
    valorTotal: g.valor,
    pctDoTotal: total > 0 ? (g.valor / total) * 100 : 0,
  }));

  list.sort((a, b) => b.valorTotal - a.valorTotal);
  return list;
}

import type { SatisfactionColor } from "@/lib/satisfacao/schema";

export interface SynthesisRowWithCliente {
  id: string;
  client_id: string;
  semana_iso: string;
  score_final: number;
  cor_final: SatisfactionColor;
  resumo_ia: string;
  divergencia_detectada: boolean;
  acao_sugerida: string | null;
  created_at: string;
  cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null;
}

export async function getRankingSatisfacao(): Promise<{
  top: SynthesisRowWithCliente[];
  bottom: SynthesisRowWithCliente[];
}> {
  const supabase = await createClient();

  // Pegar a semana_iso mais recente de qualquer síntese
  const { data: latestData } = await supabase
    .from("satisfaction_synthesis")
    .select("semana_iso")
    .order("semana_iso", { ascending: false })
    .limit(1);
  const latestWeek = (latestData?.[0] as { semana_iso?: string } | undefined)?.semana_iso;
  if (!latestWeek) return { top: [], bottom: [] };

  const { data: synthData } = await supabase
    .from("satisfaction_synthesis")
    .select("*, cliente:clients(nome, assessor_id, coordenador_id)")
    .eq("semana_iso", latestWeek);

  const all = (synthData ?? []) as unknown as SynthesisRowWithCliente[];

  const top = all
    .filter((s) => s.cor_final === "verde")
    .sort((a, b) => Number(b.score_final) - Number(a.score_final))
    .slice(0, 3);

  const bottom = all
    .filter((s) => s.cor_final === "vermelho" || s.cor_final === "amarelo")
    .sort((a, b) => {
      if (a.cor_final === "vermelho" && b.cor_final !== "vermelho") return -1;
      if (a.cor_final !== "vermelho" && b.cor_final === "vermelho") return 1;
      return Number(a.score_final) - Number(b.score_final);
    })
    .slice(0, 2);

  return { top, bottom };
}

export interface EventoRow {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  sub_calendar: "agencia" | "onboarding" | "aniversarios";
}

export async function getProximosEventos(days: number = 30, limit: number = 10): Promise<EventoRow[]> {
  const supabase = await createClient();
  const now = new Date();
  const start = now.toISOString();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, fim, sub_calendar")
    .gte("inicio", start)
    .lte("inicio", end)
    .order("inicio", { ascending: true })
    .limit(limit);

  return (data ?? []) as EventoRow[];
}

export async function getMesAguardandoAprovacao(): Promise<{ mes: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia")
    .eq("status", "pending_approval")
    .order("mes_referencia", { ascending: false })
    .limit(1);

  const row = (data?.[0] as { mes_referencia?: string } | undefined);
  return row?.mes_referencia ? { mes: row.mes_referencia } : null;
}

// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentMonthYM, getTodayDate } from "@/lib/datetime/timezone";
import type { CommissionResult, SnapshotItem } from "./schema";
import { valorEfetivoCliente, isClienteAtivoNaData } from "@/lib/clientes/ajustes";
import type { MonthlyAdjustment, TipoRelacao } from "@/lib/clientes/ajustes";

interface ProfileRow {
  id: string;
  role: string;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
}

interface ProfileWithName extends ProfileRow {
  nome: string;
}

interface ClientRow {
  id: string;
  nome?: string;
  valor_mensal: number;
  tipo_relacao: string;
  assessor_id: string | null;
  data_entrada?: string;
  data_churn?: string | null;
}

interface LeadRow {
  id: string;
  comercial_id: string | null;
  valor_proposto: number;
  client_id: string | null;
  cliente: { nome: string } | null;
}

const MONEY = (n: number) => Math.round(n * 100) / 100;

interface ProfileData {
  /** Para assessor: clientes onde é assessor (status=ativo, tipo_relacao=comum) */
  clientsAssessor?: ClientRow[];
  /** Para coordenador/audiovisual_chefe: todos clientes ativos com tipo_relacao=comum */
  clientsAgencia?: ClientRow[];
  /** Indexado por client_id */
  ajustesByClient?: Map<string, MonthlyAdjustment>;
  /** Para comercial: leads dele fechados no mês */
  leadsComercial?: LeadRow[];
}

/**
 * Lógica pura de cálculo de comissão. Recebe profile + dados pré-carregados
 * e retorna o resultado sem nenhuma query no banco.
 */
function computeCommissionForProfile(
  profile: ProfileRow,
  data: ProfileData,
): CommissionResult | null {
  // Sócio agora tem prolábore fixo (R$ 15.000 setado em `profiles.fixo_mensal`).
  // Antes retornava null - sócio era invisível no calculator. Modelo novo
  // (decisão Yasmin): sócio aparece como "Coordenador" no UI e ganha
  // prolábore fixo, sem parte variável.

  const fixo = Number(profile.fixo_mensal) || 0;
  const items: SnapshotItem[] = [
    {
      tipo: "fixo",
      descricao: profile.role === "socio" ? "Prolábore" : "Fixo mensal",
      base: 0,
      percentual: 0,
      valor: fixo,
    },
  ];

  if (profile.role === "assessor") {
    const percentual = Number(profile.comissao_percent) || 0;
    const rows = data.clientsAssessor ?? [];
    const ajustes = data.ajustesByClient ?? new Map();
    const base = rows.reduce((sum, c) => {
      const ajuste = ajustes.get(c.id) ?? null;
      return sum + valorEfetivoCliente(
        { tipo_relacao: c.tipo_relacao as TipoRelacao, valor_mensal: c.valor_mensal },
        ajuste,
      );
    }, 0);
    const valor_variavel = MONEY(base * percentual / 100);
    items.push({
      tipo: "carteira_assessor",
      descricao: `% sobre carteira (${rows.length} cliente${rows.length === 1 ? "" : "s"})`,
      base: MONEY(base),
      percentual,
      valor: valor_variavel,
    });
    return {
      snapshot: { fixo, percentual_aplicado: percentual, base_calculo: MONEY(base), valor_variavel },
      items,
    };
  }

  // Role `coordenador` foi descontinuado (decisão de produto Yasmin -
  // o que antes era "Sócio" virou "Coordenador" no UI, e a função
  // antiga de coordenador deixou de existir). Mantemos o role no enum
  // pra não quebrar referências históricas, mas qualquer perfil
  // remanescente com esse role cai no fallback de "só fixo" abaixo.

  if (profile.role === "audiovisual_chefe") {
    const percentual = Number(profile.comissao_percent) || 0;
    const rows = data.clientsAgencia ?? [];
    const ajustes = data.ajustesByClient ?? new Map();
    const base = rows.reduce((sum, c) => {
      const ajuste = ajustes.get(c.id) ?? null;
      return sum + valorEfetivoCliente(
        { tipo_relacao: c.tipo_relacao as TipoRelacao, valor_mensal: c.valor_mensal },
        ajuste,
      );
    }, 0);
    const valor_variavel = MONEY(base * percentual / 100);
    items.push({
      tipo: "carteira_coord_agencia",
      descricao: `% sobre carteira da agência (${rows.length} cliente${rows.length === 1 ? "" : "s"})`,
      base: MONEY(base),
      percentual,
      valor: valor_variavel,
    });
    return {
      snapshot: { fixo, percentual_aplicado: percentual, base_calculo: MONEY(base), valor_variavel },
      items,
    };
  }

  if (profile.role === "comercial") {
    const percentual = Number(profile.comissao_primeiro_mes_percent) || 0;
    const rows = data.leadsComercial ?? [];
    let base = 0;
    let valor_variavel = 0;
    for (const d of rows) {
      const v = Number(d.valor_proposto || 0);
      const comissao = MONEY(v * percentual / 100);
      base += v;
      valor_variavel += comissao;
      items.push({
        tipo: "deal_fechado_comercial",
        descricao: `${d.cliente?.nome ?? "Cliente"} · 1º mês R$ ${v.toFixed(2)}`,
        base: MONEY(v),
        percentual,
        valor: comissao,
        lead_id: d.id,
        client_id: d.client_id ?? undefined,
      });
    }
    return {
      snapshot: { fixo, percentual_aplicado: percentual, base_calculo: MONEY(base), valor_variavel: MONEY(valor_variavel) },
      items,
    };
  }

  // Demais roles (socio, coordenador legado, adm, videomaker, designer,
  // editor, etc.): só fixo. Para sócio, esse fixo é o prolábore configurado
  // em `profiles.fixo_mensal` (sugestão R$ 15.000).
  return {
    snapshot: { fixo, percentual_aplicado: 0, base_calculo: 0, valor_variavel: 0 },
    items,
  };
}

/**
 * Data de referência pra "ativo por data": hoje se for o mês corrente, senão o
 * último dia do mês (fechado). Espelha o todayIso do KPI de carteira.
 */
function refDateForMonth(monthRef: string): string {
  return monthRef === getCurrentMonthYM() ? getTodayDate() : getMonthRange(monthRef).lastDay;
}

function getMonthRange(monthRef: string): { firstDay: string; lastDay: string } {
  const [year, month] = monthRef.split("-").map(Number);
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  // Dia 0 do próximo mês = último dia do mês corrente. Usa Date.UTC pra evitar
  // qualquer ambiguidade de fuso ao reconverter pra YYYY-MM-DD.
  const lastDayUtc = new Date(Date.UTC(year, month, 0));
  const lastDay = `${lastDayUtc.getUTCFullYear()}-${String(lastDayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDayUtc.getUTCDate()).padStart(2, "0")}`;
  return { firstDay, lastDay };
}

/**
 * Cálculo individual: 1 user por vez. Faz 1-3 queries dependendo do role.
 * Mantém compatibilidade com call-sites pré-batch (previewMyCommission, generator).
 */
export async function calculateCommission(
  userId: string,
  monthRef: string,
): Promise<CommissionResult | null> {
  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent")
    .eq("id", userId)
    .single();
  if (!profile) return null;
  const p = profile as unknown as ProfileRow;
  // Sócio agora entra no cálculo (prolábore fixo). Antes retornávamos null.
  const data: ProfileData = {};

  if (p.role === "assessor") {
    const { data: clientsRows } = await supabase
      .from("clients")
      .select("valor_mensal, nome, id, tipo_relacao, assessor_id, data_entrada, data_churn")
      .eq("assessor_id", userId)
      .eq("status", "ativo")
      .eq("tipo_relacao", "comum")
      .is("deleted_at", null);
    // Só clientes já vigentes na data de referência (mesma regra da carteira):
    // status='ativo' com data_entrada no futuro ainda não gera comissão.
    const refIso = refDateForMonth(monthRef);
    const rows = ((clientsRows ?? []) as ClientRow[]).filter((c) =>
      isClienteAtivoNaData({ data_entrada: c.data_entrada ?? "", data_churn: c.data_churn ?? null }, refIso),
    );
    data.clientsAssessor = rows;

    const ajustesRes = await supabase
      .from("client_monthly_adjustments")
      .select("*")
      .in("client_id", rows.map((r) => r.id))
      .eq("mes_referencia", monthRef);
    data.ajustesByClient = new Map(
      ((ajustesRes.data ?? []) as MonthlyAdjustment[]).map((a) => [a.client_id, a]),
    );
  } else if (p.role === "audiovisual_chefe") {
    // Coordenador SEM parte variável (só fixo) - não precisa buscar clientes/ajustes.
    // Audiovisual_chefe continua com fixo + % sobre carteira da agência.
    const { data: clientsRows } = await supabase
      .from("clients")
      .select("valor_mensal, id, tipo_relacao, assessor_id")
      .eq("status", "ativo")
      .eq("tipo_relacao", "comum")
      .is("deleted_at", null);
    const rows = (clientsRows ?? []) as ClientRow[];
    data.clientsAgencia = rows;

    const ajustesRes = await supabase
      .from("client_monthly_adjustments")
      .select("*")
      .in("client_id", rows.map((r) => r.id))
      .eq("mes_referencia", monthRef);
    data.ajustesByClient = new Map(
      ((ajustesRes.data ?? []) as MonthlyAdjustment[]).map((a) => [a.client_id, a]),
    );
  } else if (p.role === "comercial") {
    const { firstDay, lastDay } = getMonthRange(monthRef);
    const { data: dealsRows } = await supabase
      .from("leads")
      .select("id, valor_proposto, client_id, comercial_id, cliente:clients(nome)")
      .eq("comercial_id", userId)
      .is("deleted_at", null)
      .gte("data_fechamento", firstDay)
      .lte("data_fechamento", lastDay);
    data.leadsComercial = (dealsRows ?? []) as unknown as LeadRow[];
  }

  return computeCommissionForProfile(p, data);
}

export interface BatchEntry {
  profile: { id: string; nome: string; role: string };
  result: CommissionResult;
}

/**
 * Cálculo em batch pra TODOS os colaboradores ativos de uma vez. Faz só 4
 * queries paralelas no banco (em vez de N queries por user) e computa em
 * memória. Drop-in pro previewAllForMonth - ganho de ~60→4 queries.
 */
export async function calculateCommissionsBatch(monthRef: string): Promise<BatchEntry[]> {
  const supabase = createServiceRoleClient();
  const { firstDay, lastDay } = getMonthRange(monthRef);

  const [profilesRes, clientsRes, adjustmentsRes, leadsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, role, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent")
      .eq("ativo", true)
      // Sócio inclui no batch (recebe prolábore fixo). Antes era excluído.
      .order("nome"),
    supabase
      .from("clients")
      .select("id, nome, valor_mensal, tipo_relacao, assessor_id, data_entrada, data_churn")
      .eq("status", "ativo")
      .eq("tipo_relacao", "comum")
      .is("deleted_at", null),
    supabase
      .from("client_monthly_adjustments")
      .select("*")
      .eq("mes_referencia", monthRef),
    supabase
      .from("leads")
      .select("id, comercial_id, valor_proposto, client_id, cliente:clients(nome)")
      .is("deleted_at", null)
      .gte("data_fechamento", firstDay)
      .lte("data_fechamento", lastDay),
  ]);

  const profiles = ((profilesRes.data ?? []) as unknown as ProfileWithName[]) ?? [];
  const allClients = ((clientsRes.data ?? []) as unknown as ClientRow[]) ?? [];
  const ajustes = ((adjustmentsRes.data ?? []) as MonthlyAdjustment[]) ?? [];
  const leads = ((leadsRes.data ?? []) as unknown as LeadRow[]) ?? [];

  // Indexa pra acesso O(1) por user
  const ajustesByClient = new Map(ajustes.map((a) => [a.client_id, a]));

  // Comissão do assessor: só clientes já vigentes na data de referência do mês
  // (mesma regra da carteira). Agência (clientsAgencia) mantém comportamento atual.
  const refIso = refDateForMonth(monthRef);
  const clientsByAssessor = new Map<string, ClientRow[]>();
  for (const c of allClients) {
    if (!c.assessor_id) continue;
    if (!isClienteAtivoNaData({ data_entrada: c.data_entrada ?? "", data_churn: c.data_churn ?? null }, refIso)) {
      continue;
    }
    const arr = clientsByAssessor.get(c.assessor_id) ?? [];
    arr.push(c);
    clientsByAssessor.set(c.assessor_id, arr);
  }

  const leadsByComercial = new Map<string, LeadRow[]>();
  for (const l of leads) {
    if (!l.comercial_id) continue;
    const arr = leadsByComercial.get(l.comercial_id) ?? [];
    arr.push(l);
    leadsByComercial.set(l.comercial_id, arr);
  }

  const results: BatchEntry[] = [];
  for (const p of profiles) {
    const result = computeCommissionForProfile(p, {
      clientsAssessor: clientsByAssessor.get(p.id) ?? [],
      clientsAgencia: allClients,
      ajustesByClient,
      leadsComercial: leadsByComercial.get(p.id) ?? [],
    });
    if (!result) continue;
    results.push({
      profile: { id: p.id, nome: p.nome, role: p.role },
      result,
    });
  }

  return results;
}

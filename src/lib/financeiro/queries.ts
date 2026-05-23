// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { previewAllForMonth } from "@/lib/comissoes/preview";
import {
  expenseAplicaNoMes,
  valorNoMes,
  calcMargem,
  type ExpenseRow,
  type OverrideRow,
} from "./dre-calc";
import type { ExpenseCategoria, ExpenseTipo } from "./schema";
import { FINANCEIRO_CACHE_TAG } from "./schema";

export interface DRELine {
  expenseId: string;
  descricao: string;
  categoria: ExpenseCategoria;
  valor: number;
  overrideAplicado: boolean;
}

export interface ColaboradorBreakdown {
  user_id: string;
  nome: string;
  role: string;
  fixo: number;
  comissao: number;
  total: number;
}

export interface DREData {
  mesRef: string;
  receita_bruta: number;
  custo_servicos: { comissoes: number; trafego: number; total: number };
  lucro_bruto: number;
  margem_bruta_pct: number;
  salarios: number;
  despesas: DRELine[];
  total_despesas: number;
  lucro_operacional: number;
  margem_operacional_pct: number;
  /** Breakdown por colaborador (fixo + comissão por pessoa, ordenado por total desc). */
  colaboradores: ColaboradorBreakdown[];
}

/** Verifica se cliente estava ativo em algum momento durante o mês (YYYY-MM). */
function clienteAtivoNoMes(c: { data_entrada: string; data_churn: string | null }, mesRef: string): boolean {
  const inicioMes = `${mesRef}-01`;
  const fimMes = `${mesRef}-31`;
  if (c.data_entrada > fimMes) return false;
  if (c.data_churn && c.data_churn < inicioMes) return false;
  return true;
}

async function _getDREImpl(mesRef: string): Promise<DREData> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // ── Fase 1: 4 queries independentes em paralelo (clients, snapshots, profiles, expenses)
  const [clientsRes, snapshotsRes, profilesRes, expensesRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, valor_mensal, valor_trafego_google, valor_trafego_meta, data_entrada, data_churn, tipo_relacao, status")
      .is("deleted_at", null)
      .neq("status", "em_onboarding"),
    supabase
      .from("commission_snapshots")
      .select("user_id, fixo, valor_variavel, valor_total")
      .eq("mes_referencia", mesRef),
    supabase
      .from("profiles")
      .select("id, nome, fixo_mensal, role, ativo")
      .eq("ativo", true)
      .neq("role", "socio"),
    sb
      .from("expenses")
      .select("id, descricao, categoria, tipo, valor, mes_referencia, inicio_mes, fim_mes"),
  ]);

  const allClients = (clientsRes.data ?? []) as Array<{
    id: string;
    valor_mensal: number;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
    data_entrada: string;
    data_churn: string | null;
    tipo_relacao: string | null;
    status: string;
  }>;
  const ativosNoMes = allClients.filter((c) => clienteAtivoNoMes(c, mesRef));
  const ativosComum = ativosNoMes.filter((c) => !c.tipo_relacao || c.tipo_relacao === "comum");

  const receita_bruta = ativosComum.reduce((a, c) => a + Number(c.valor_mensal), 0);
  const trafego = ativosNoMes.reduce(
    (a, c) => a + Number(c.valor_trafego_google ?? 0) + Number(c.valor_trafego_meta ?? 0),
    0,
  );

  const snapshots = (snapshotsRes.data ?? []) as Array<{
    user_id: string;
    fixo: number;
    valor_variavel: number;
    valor_total: number;
  }>;
  const profiles = (profilesRes.data ?? []) as Array<{
    id: string;
    nome: string;
    fixo_mensal: number;
    role: string;
  }>;
  const expenses = (expensesRes.data ?? []) as ExpenseRow[];
  const expenseIds = expenses.map((e) => e.id);

  // ── Fase 2: overrides (depende de expenseIds) + previewLive (só se snapshots vazios) em paralelo
  const needsPreview = snapshots.length === 0;

  const [overridesData, previewRows] = await Promise.all([
    expenseIds.length === 0
      ? Promise.resolve([])
      : sb
          .from("expense_overrides")
          .select("id, expense_id, mes_referencia, valor")
          .eq("mes_referencia", mesRef)
          .in("expense_id", expenseIds)
          .then((r: { data: OverrideRow[] | null }) => r.data ?? []),
    needsPreview ? previewAllForMonth(mesRef) : Promise.resolve([]),
  ]);
  const overrides = overridesData as OverrideRow[];

  // ── Comissões = só a parte VARIÁVEL (valor_variavel). O fixo já é contado
  // em "Salários fixos" abaixo - usar valor_total aqui causaria double-counting.
  const variavelPorUser = new Map<string, number>();
  if (needsPreview) {
    for (const r of previewRows as Array<{ profile: { id: string } | null; valor_variavel: number }>) {
      if (r.profile?.id) variavelPorUser.set(r.profile.id, Number(r.valor_variavel) || 0);
    }
  } else {
    for (const s of snapshots) {
      variavelPorUser.set(s.user_id, Number(s.valor_variavel) || 0);
    }
  }
  const comissoes = [...variavelPorUser.values()].reduce((a, v) => a + v, 0);

  // Salários fixos: profiles.fixo_mensal (single source of truth)
  const salarios = profiles.reduce((a, p) => a + Number(p.fixo_mensal ?? 0), 0);

  // Breakdown por colaborador (ordenado por total desc)
  const colaboradores: ColaboradorBreakdown[] = profiles
    .map((p) => {
      const fixo = Number(p.fixo_mensal ?? 0);
      const comissao = variavelPorUser.get(p.id) ?? 0;
      return { user_id: p.id, nome: p.nome, role: p.role, fixo, comissao, total: fixo + comissao };
    })
    .sort((a, b) => b.total - a.total);

  const despesas: DRELine[] = expenses
    .filter((e) => expenseAplicaNoMes(e, mesRef))
    .map((e) => {
      const ov = overrides.find((o) => o.expense_id === e.id);
      return {
        expenseId: e.id,
        descricao: e.descricao,
        categoria: e.categoria,
        valor: valorNoMes(e, mesRef, overrides),
        overrideAplicado: !!ov,
      };
    });

  const total_despesas = despesas.reduce((a, d) => a + d.valor, 0);
  const custo_servicos_total = comissoes + trafego;
  const lucro_bruto = receita_bruta - custo_servicos_total;
  const lucro_operacional = lucro_bruto - salarios - total_despesas;

  return {
    mesRef,
    receita_bruta,
    custo_servicos: { comissoes, trafego, total: custo_servicos_total },
    lucro_bruto,
    margem_bruta_pct: calcMargem(lucro_bruto, receita_bruta) * 100,
    salarios,
    despesas,
    total_despesas,
    lucro_operacional,
    margem_operacional_pct: calcMargem(lucro_operacional, receita_bruta) * 100,
    colaboradores,
  };
}

export async function getDRE(mesRef: string): Promise<DREData> {
  // Cache key versionado: bumpar quando mudar o shape do DREData (ex: v2 quando
  // adicionamos `colaboradores`). Sem o bump, entradas antigas no cache distribuído
  // do Vercel ficavam servindo objetos sem o novo campo, quebrando a UI cliente.
  const cached = unstable_cache(
    async (mes: string) => _getDREImpl(mes),
    ["financeiro-dre-v2"],
    { revalidate: 300, tags: [FINANCEIRO_CACHE_TAG, "dashboard"] },
  );
  return cached(mesRef);
}

export async function getDRESeries(meses: string[]): Promise<DREData[]> {
  return Promise.all(meses.map((m) => getDRE(m)));
}

export interface ExpenseListRow extends ExpenseRow {
  notas: string | null;
  created_at: string;
}

export async function listExpenses(filters?: {
  tipo?: ExpenseTipo;
  categoria?: ExpenseCategoria;
  mes_referencia?: string;
}): Promise<ExpenseListRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let query = sb
    .from("expenses")
    .select("id, descricao, categoria, tipo, valor, mes_referencia, inicio_mes, fim_mes, notas, created_at")
    .order("created_at", { ascending: false });
  if (filters?.tipo) query = query.eq("tipo", filters.tipo);
  if (filters?.categoria) query = query.eq("categoria", filters.categoria);
  if (filters?.mes_referencia) query = query.eq("mes_referencia", filters.mes_referencia);
  const { data } = await query;
  return (data ?? []) as ExpenseListRow[];
}

export async function getExpenseById(id: string): Promise<ExpenseListRow | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("expenses")
    .select("id, descricao, categoria, tipo, valor, mes_referencia, inicio_mes, fim_mes, notas, created_at")
    .eq("id", id)
    .single();
  return (data as ExpenseListRow | null) ?? null;
}

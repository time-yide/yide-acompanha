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

  // ── Receita: clientes ativos no mês com tipo_relacao='comum'
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, valor_trafego_google, valor_trafego_meta, data_entrada, data_churn, tipo_relacao, status")
    .neq("status", "em_onboarding");
  const allClients = (clientsData ?? []) as Array<{
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

  // ── Comissões: snapshot ou preview live
  const { data: snapshotsData } = await supabase
    .from("commission_snapshots")
    .select("valor_total")
    .eq("mes_referencia", mesRef);
  const snapshots = (snapshotsData ?? []) as Array<{ valor_total: number }>;
  let comissoes = snapshots.reduce((a, s) => a + Number(s.valor_total), 0);

  if (comissoes === 0) {
    const previewRows = await previewAllForMonth(mesRef);
    comissoes = previewRows.reduce((a, r) => a + Number(r.valor_total), 0);
  }

  // ── Salários: profiles ativos, exceto sócio (pró-labore vai como despesa manual)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("fixo_mensal, role, ativo")
    .eq("ativo", true)
    .neq("role", "socio");
  const salarios = ((profilesData ?? []) as Array<{ fixo_mensal: number }>).reduce(
    (a, p) => a + Number(p.fixo_mensal ?? 0),
    0,
  );

  // ── Despesas manuais (tabelas novas — types ainda não regenerados)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: expensesData } = await sb
    .from("expenses")
    .select("id, descricao, categoria, tipo, valor, mes_referencia, inicio_mes, fim_mes");
  const expenses = (expensesData ?? []) as ExpenseRow[];

  const expenseIds = expenses.map((e) => e.id);
  const overridesData = expenseIds.length === 0
    ? []
    : (await sb
        .from("expense_overrides")
        .select("id, expense_id, mes_referencia, valor")
        .eq("mes_referencia", mesRef)
        .in("expense_id", expenseIds)).data ?? [];
  const overrides = overridesData as OverrideRow[];

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
  };
}

export async function getDRE(mesRef: string): Promise<DREData> {
  const cached = unstable_cache(
    async (mes: string) => _getDREImpl(mes),
    ["financeiro-dre"],
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

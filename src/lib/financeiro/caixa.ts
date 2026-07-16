// SERVER ONLY: não importar de client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDRE } from "./queries";

export interface FluxoCaixaPonto {
  mesRef: string;
  /** Soma de valor_mensal dos clientes com client_payments.status='pago' no mês. */
  recebido: number;
  /** Soma de capital_aportes.valor cuja data cai no mês (0 se tabela ausente). */
  aportes: number;
  /** Recebido + Aportes. */
  entradas: number;
  /** Custo total do DRE do mês (custo_servicos.total + salarios + total_despesas). */
  saidas: number;
  /** Entradas − Saídas. */
  saldoMes: number;
  /** Soma corrente dos saldos, na ordem dos meses. */
  saldoAcumulado: number;
}

export interface AporteRow {
  id: string;
  data: string;
  valor: number;
  socio_id: string;
  socio_nome: string;
  tipo: "capital" | "emprestimo";
  descricao: string | null;
  created_at: string;
}

/** Primeiro e último dia (YYYY-MM-DD) de um mês YYYY-MM. */
function mesBounds(mesRef: string): { inicio: string; fim: string } {
  const [y, m] = mesRef.split("-").map(Number);
  const fimDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    inicio: `${mesRef}-01`,
    fim: `${mesRef}-${String(fimDay).padStart(2, "0")}`,
  };
}

/**
 * Recebido por mês = soma de clients.valor_mensal dos clientes ativos comuns
 * cujo client_payments daquele mes_referencia está 'pago'. Resiliente: se a
 * tabela client_payments não existe, recebido = 0 pra todos os meses.
 */
async function getRecebidoPorMes(meses: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>(meses.map((m) => [m, 0]));
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;

    const { data: pagos, error } = await sb
      .from("client_payments")
      .select("client_id, mes_referencia, status")
      .eq("status", "pago")
      .in("mes_referencia", meses);
    if (error) return out; // tabela inexistente / schema cache → recebido 0

    const pagosRows = (pagos ?? []) as Array<{ client_id: string; mes_referencia: string }>;
    if (pagosRows.length === 0) return out;

    const clientIds = [...new Set(pagosRows.map((r) => r.client_id))];
    const { data: clientesData } = await sb
      .from("clients")
      .select("id, valor_mensal, status, tipo_relacao, deleted_at")
      .in("id", clientIds);

    const info = new Map<string, { valor: number; ok: boolean }>();
    for (const c of (clientesData ?? []) as Array<{
      id: string;
      valor_mensal: number | null;
      status: string | null;
      tipo_relacao: string | null;
      deleted_at: string | null;
    }>) {
      info.set(c.id, {
        valor: Number(c.valor_mensal) || 0,
        ok: c.status === "ativo" && (c.tipo_relacao ?? "comum") === "comum" && !c.deleted_at,
      });
    }

    for (const r of pagosRows) {
      const i = info.get(r.client_id);
      if (!i || !i.ok) continue;
      out.set(r.mes_referencia, (out.get(r.mes_referencia) ?? 0) + i.valor);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Aportes por mês = soma de capital_aportes.valor cuja data cai no mês.
 * Resiliente: se a tabela ainda não existe (migration não aplicada), 0 pra tudo.
 */
async function getAportesPorMes(meses: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>(meses.map((m) => [m, 0]));
  if (meses.length === 0) return out;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;

    const inicio = mesBounds(meses[0]).inicio;
    const fim = mesBounds(meses[meses.length - 1]).fim;

    const { data, error } = await sb
      .from("capital_aportes")
      .select("data, valor")
      .gte("data", inicio)
      .lte("data", fim);
    if (error) return out; // tabela inexistente → aportes 0

    for (const r of (data ?? []) as Array<{ data: string; valor: number | null }>) {
      const mes = String(r.data).slice(0, 7);
      if (out.has(mes)) out.set(mes, (out.get(mes) ?? 0) + (Number(r.valor) || 0));
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Fluxo de caixa por mês (ordem = ordem dos meses passados). Para cada mês:
 * Entradas = Recebido + Aportes; Saídas = custo total do DRE; Saldo do mês =
 * Entradas − Saídas; Saldo acumulado = soma corrente.
 */
export async function getFluxoCaixa(meses: string[]): Promise<FluxoCaixaPonto[]> {
  const [recebidoMap, aportesMap, dres] = await Promise.all([
    getRecebidoPorMes(meses),
    getAportesPorMes(meses),
    Promise.all(meses.map((m) => getDRE(m))),
  ]);

  let acumulado = 0;
  return meses.map((mesRef, i) => {
    const recebido = recebidoMap.get(mesRef) ?? 0;
    const aportes = aportesMap.get(mesRef) ?? 0;
    const entradas = recebido + aportes;
    const dre = dres[i];
    const saidas = dre.custo_servicos.total + dre.salarios + dre.total_despesas;
    const saldoMes = entradas - saidas;
    acumulado += saldoMes;
    return { mesRef, recebido, aportes, entradas, saidas, saldoMes, saldoAcumulado: acumulado };
  });
}

/**
 * Lista aportes (mais recentes primeiro) com o nome do sócio responsável.
 * Resiliente: tabela ausente → lista vazia.
 */
export async function listAportes(): Promise<AporteRow[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;

    const { data, error } = await sb
      .from("capital_aportes")
      .select("id, data, valor, socio_id, tipo, descricao, created_at")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return [];

    const rows = (data ?? []) as Array<{
      id: string;
      data: string;
      valor: number;
      socio_id: string;
      tipo: "capital" | "emprestimo";
      descricao: string | null;
      created_at: string;
    }>;
    if (rows.length === 0) return [];

    const socioIds = [...new Set(rows.map((r) => r.socio_id))];
    const { data: profs } = await sb
      .from("profiles")
      .select("id, nome")
      .in("id", socioIds);
    const nomeById = new Map(
      ((profs ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]),
    );

    return rows.map((r) => ({
      id: r.id,
      data: r.data,
      valor: Number(r.valor) || 0,
      socio_id: r.socio_id,
      socio_nome: nomeById.get(r.socio_id) ?? "—",
      tipo: r.tipo,
      descricao: r.descricao,
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}

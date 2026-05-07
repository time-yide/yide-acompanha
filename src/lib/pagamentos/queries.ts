// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ClientPaymentRow {
  client_id: string;
  client_nome: string;
  valor_mensal: number;
  /** Tipo de relação: comum, parceria, permuta. Parceria/permuta sempre = 0. */
  tipo_relacao: "comum" | "parceria" | "permuta";
  status: "pago" | "pendente";
  paid_at: string | null;
  observacao: string | null;
  payment_id: string | null;
  /** Ajuste do mês — quando preenchido, redefine o valor efetivo cobrado e
   * a base de comissão de assessor/coord. */
  ajuste_tipo: "desconto_parcial" | "gratuidade_total" | null;
  ajuste_valor_desconto: number | null;
  ajuste_motivo: string | null;
  /** Valor que o cliente realmente paga no mês depois do ajuste. */
  valor_efetivo: number;
}

/**
 * Lista clientes ATIVOS com:
 * - Status de pagamento do mês (pendente implícito quando não há registro)
 * - Ajuste mensal (gratuidade/desconto) — alimenta a redistribuição de comissão
 * - valor_efetivo (valor que o cliente realmente paga depois do ajuste)
 */
export async function listClientPaymentsForMonth(mesReferencia: string): Promise<ClientPaymentRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: clientes }, { data: payments }, { data: ajustes }] = await Promise.all([
    sb
      .from("clients")
      .select("id, nome, valor_mensal, tipo_relacao")
      .eq("status", "ativo")
      .order("nome"),
    sb
      .from("client_payments")
      .select("id, client_id, status, paid_at, observacao")
      .eq("mes_referencia", mesReferencia),
    sb
      .from("client_monthly_adjustments")
      .select("client_id, tipo, valor_desconto, motivo")
      .eq("mes_referencia", mesReferencia),
  ]);

  const paymentByClient = new Map(
    ((payments ?? []) as Array<{ id: string; client_id: string; status: string; paid_at: string | null; observacao: string | null }>).map(
      (p) => [p.client_id, p],
    ),
  );
  const ajusteByClient = new Map(
    ((ajustes ?? []) as Array<{ client_id: string; tipo: "desconto_parcial" | "gratuidade_total"; valor_desconto: number | null; motivo: string }>).map(
      (a) => [a.client_id, a],
    ),
  );

  return ((clientes ?? []) as Array<{ id: string; nome: string; valor_mensal: number; tipo_relacao: "comum" | "parceria" | "permuta" }>).map((c) => {
    const p = paymentByClient.get(c.id);
    const a = ajusteByClient.get(c.id) ?? null;
    const valor_mensal = Number(c.valor_mensal);

    // Mesma lógica de valorEfetivoCliente — replicada aqui pra evitar
    // dependência cruzada entre lib/pagamentos e lib/clientes.
    let valor_efetivo: number;
    if (c.tipo_relacao !== "comum") {
      valor_efetivo = 0;
    } else if (!a) {
      valor_efetivo = valor_mensal;
    } else if (a.tipo === "gratuidade_total") {
      valor_efetivo = 0;
    } else {
      valor_efetivo = Math.max(0, valor_mensal - Number(a.valor_desconto ?? 0));
    }

    return {
      client_id: c.id,
      client_nome: c.nome,
      valor_mensal,
      tipo_relacao: c.tipo_relacao,
      status: (p?.status as "pago" | "pendente") ?? "pendente",
      paid_at: p?.paid_at ?? null,
      observacao: p?.observacao ?? null,
      payment_id: p?.id ?? null,
      ajuste_tipo: a?.tipo ?? null,
      ajuste_valor_desconto: a?.valor_desconto ?? null,
      ajuste_motivo: a?.motivo ?? null,
      valor_efetivo,
    };
  });
}

export interface PayrollRow {
  user_id: string;
  user_nome: string;
  user_role: string;
  fixo_mensal: number;
  comissao_mes: number;
  total: number;
  status: "pago" | "pendente";
  paid_at: string | null;
  observacao: string | null;
  payment_id: string | null;
}

/**
 * Lista colaboradores ATIVOS com remuneração do mês:
 * - fixo_mensal vem do profile
 * - comissão vem do snapshot APROVADO daquele mês (se tiver)
 * - status pago/pendente vem do payroll_payments
 */
export async function listPayrollForMonth(mesReferencia: string): Promise<PayrollRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: profiles }, { data: snapshots }, { data: payments }] = await Promise.all([
    sb
      .from("profiles")
      .select("id, nome, role, fixo_mensal")
      .eq("ativo", true)
      .order("nome"),
    sb
      .from("commission_snapshots")
      .select("user_id, valor_total, status")
      .eq("mes_referencia", mesReferencia),
    sb
      .from("payroll_payments")
      .select("id, user_id, status, paid_at, observacao")
      .eq("mes_referencia", mesReferencia),
  ]);

  const snapshotByUser = new Map(
    ((snapshots ?? []) as Array<{ user_id: string; valor_total: number; status: string }>).map(
      (s) => [s.user_id, s],
    ),
  );
  const paymentByUser = new Map(
    ((payments ?? []) as Array<{ id: string; user_id: string; status: string; paid_at: string | null; observacao: string | null }>).map(
      (p) => [p.user_id, p],
    ),
  );

  return ((profiles ?? []) as Array<{ id: string; nome: string; role: string; fixo_mensal: number }>).map((u) => {
    const snap = snapshotByUser.get(u.id);
    const fixo = Number(u.fixo_mensal ?? 0);
    // Se já tem snapshot aprovado, usa valor_total dele (já inclui fixo + variável + ajustes).
    // Senão, mostra só o fixo como base.
    const totalSnapshot = snap ? Number(snap.valor_total) : null;
    const total = totalSnapshot ?? fixo;
    const comissao = totalSnapshot !== null ? Math.max(0, totalSnapshot - fixo) : 0;
    const p = paymentByUser.get(u.id);
    return {
      user_id: u.id,
      user_nome: u.nome,
      user_role: u.role,
      fixo_mensal: fixo,
      comissao_mes: comissao,
      total,
      status: (p?.status as "pago" | "pendente") ?? "pendente",
      paid_at: p?.paid_at ?? null,
      observacao: p?.observacao ?? null,
      payment_id: p?.id ?? null,
    };
  });
}

/** Helper: YYYY-MM do mês corrente em UTC. */
export function getCurrentMonthRef(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

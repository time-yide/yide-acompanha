// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CommissionResult, SnapshotItem } from "./schema";
import { valorEfetivoCliente } from "@/lib/clientes/ajustes";
import type { MonthlyAdjustment, TipoRelacao } from "@/lib/clientes/ajustes";

interface ProfileRow {
  id: string;
  role: string;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
}

const MONEY = (n: number) => Math.round(n * 100) / 100;

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
  if (p.role === "socio") return null;

  const fixo = Number(p.fixo_mensal) || 0;
  const items: SnapshotItem[] = [
    { tipo: "fixo", descricao: "Fixo mensal", base: 0, percentual: 0, valor: fixo },
  ];

  if (p.role === "assessor") {
    const percentual = Number(p.comissao_percent) || 0;
    const { data: clientsRows } = await supabase
      .from("clients")
      .select("valor_mensal, nome, id, tipo_relacao")
      .eq("assessor_id", userId)
      .eq("status", "ativo")
      .eq("tipo_relacao", "comum");
    const rows = (clientsRows ?? []) as Array<{ valor_mensal: number; nome: string; id: string; tipo_relacao: string }>;

    // Carregar ajustes do mês para aplicar valor efetivo
    const ajustesRes = await supabase
      .from("client_monthly_adjustments")
      .select("*")
      .in("client_id", rows.map((r) => r.id))
      .eq("mes_referencia", monthRef);
    const ajustesMap = new Map(
      ((ajustesRes.data ?? []) as MonthlyAdjustment[]).map((a) => [a.client_id, a])
    );

    const base = rows.reduce((sum, c) => {
      const ajuste = ajustesMap.get(c.id) ?? null;
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

  if (p.role === "coordenador" || p.role === "audiovisual_chefe") {
    const percentual = Number(p.comissao_percent) || 0;
    const { data: clientsRows } = await supabase
      .from("clients")
      .select("valor_mensal, id, tipo_relacao")
      .eq("status", "ativo")
      .eq("tipo_relacao", "comum");
    const rows = (clientsRows ?? []) as Array<{ valor_mensal: number; id: string; tipo_relacao: string }>;

    // Carregar ajustes do mês para aplicar valor efetivo
    const ajustesRes = await supabase
      .from("client_monthly_adjustments")
      .select("*")
      .in("client_id", rows.map((r) => r.id))
      .eq("mes_referencia", monthRef);
    const ajustesMap = new Map(
      ((ajustesRes.data ?? []) as MonthlyAdjustment[]).map((a) => [a.client_id, a])
    );

    const base = rows.reduce((sum, c) => {
      const ajuste = ajustesMap.get(c.id) ?? null;
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

  if (p.role === "comercial") {
    const percentual = Number(p.comissao_primeiro_mes_percent) || 0;
    const [year, month] = monthRef.split("-").map(Number);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayDate = new Date(year, month, 0);
    const lastDay = `${lastDayDate.getFullYear()}-${String(lastDayDate.getMonth() + 1).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
    const { data: dealsRows } = await supabase
      .from("leads")
      .select("id, valor_proposto, client_id, cliente:clients(nome)")
      .eq("comercial_id", userId)
      .gte("data_fechamento", firstDay)
      .lte("data_fechamento", lastDay);
    const rows = (dealsRows ?? []) as Array<{ id: string; valor_proposto: number; client_id: string | null; cliente: { nome: string } | null }>;
    let base = 0;
    let valor_variavel = 0;
    for (const d of rows) {
      const v = Number(d.valor_proposto || 0);
      const comissao = MONEY(v * percentual / 100);
      base += v;
      valor_variavel += comissao;
      items.push({
        tipo: "deal_fechado_comercial",
        descricao: `${d.cliente?.nome ?? "Cliente"} — 1º mês R$ ${v.toFixed(2)}`,
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

  // ADM, videomaker, designer, editor: só fixo
  return {
    snapshot: { fixo, percentual_aplicado: 0, base_calculo: 0, valor_variavel: 0 },
    items,
  };
}

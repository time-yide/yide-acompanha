// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";
import { lastDayOfMonth } from "./date-utils";
import { valorEfetivoCliente } from "@/lib/clientes/ajustes";
import type { MonthlyAdjustment, TipoRelacao } from "@/lib/clientes/ajustes";

export interface ComissaoPrevista {
  valor: number;
  valorVariavel: number;
  baseCalculo: number;
  fixo: number;
  percentual: number;
}

type Role = "assessor" | "coordenador" | "comercial" | "socio";

interface ProfileRow {
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
}

export async function getComissaoPrevista(
  userId: string,
  role: Role,
  now: Date = new Date(),
): Promise<ComissaoPrevista> {
  // service-role bypassa REVOKE nas colunas sensíveis; userId é sempre auth.uid() do caller.
  const supabase = createServiceRoleClient();
  const monthRef = getCurrentMonthYM(now);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("fixo_mensal, comissao_percent, comissao_primeiro_mes_percent")
    .eq("id", userId)
    .single();
  const profile = (profileData as ProfileRow | null) ?? {
    fixo_mensal: 0,
    comissao_percent: 0,
    comissao_primeiro_mes_percent: 0,
  };

  let valorComissao = 0;
  let baseCalculo = 0;

  // Sócio (novo "Coordenador" no UI) e coordenador legado: só fixo
  // (prolábore de R$ 15.000 configurado em profiles.fixo_mensal pra sócio).
  // Mantém base=0, comissao=0, percentual=0 - devolve só o fixo abaixo.
  if (role === "socio" || role === "coordenador") {
    // intencional: pula cálculo variável
  } else if (role === "assessor") {
    // Só carteira "comum" entra na comissão (parceria/permuta = R$ 0).
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, valor_mensal, tipo_relacao")
      .eq("status", "ativo")
      .eq("tipo_relacao", "comum")
      .is("deleted_at", null)
      .eq("assessor_id", userId);

    const clients = (clientsData ?? []) as Array<{ id: string; valor_mensal: number; tipo_relacao: string }>;

    // Ajustes do mês (desconto parcial / gratuidade) reduzem a base efetiva.
    const ajustesByClient = new Map<string, MonthlyAdjustment>();
    if (clients.length > 0) {
      const { data: ajustesData } = await supabase
        .from("client_monthly_adjustments")
        .select("*")
        .in("client_id", clients.map((c) => c.id))
        .eq("mes_referencia", monthRef);
      for (const a of (ajustesData ?? []) as MonthlyAdjustment[]) {
        ajustesByClient.set(a.client_id, a);
      }
    }

    // Mesma regra dos snapshots efetivamente pagos (calculator.ts): % FIXA
    // da carteira sobre o valor efetivo de cada cliente. SEM bônus de 1º mês
    // — esse bônus é só do comercial que fechou o deal.
    for (const c of clients) {
      baseCalculo += valorEfetivoCliente(
        { tipo_relacao: c.tipo_relacao as TipoRelacao, valor_mensal: c.valor_mensal },
        ajustesByClient.get(c.id) ?? null,
      );
    }
    valorComissao = baseCalculo * (profile.comissao_percent / 100);
  } else if (role === "comercial") {
    const inicioMes = `${monthRef}-01`;
    const fimMes = lastDayOfMonth(monthRef);

    const { data: leadsData } = await supabase
      .from("leads")
      .select("id, valor_proposto, data_fechamento")
      .eq("comercial_id", userId)
      .eq("stage", "ativo")
      .is("deleted_at", null)
      .gte("data_fechamento", inicioMes)
      .lte("data_fechamento", fimMes);

    const leads = (leadsData ?? []) as Array<{ id: string; valor_proposto: number; data_fechamento: string }>;

    for (const l of leads) {
      const valor = Number(l.valor_proposto);
      baseCalculo += valor;
      valorComissao += valor * (profile.comissao_percent / 100);
    }
  }

  const fixo = Number(profile.fixo_mensal);
  // Sócio/coordenador legado: ignora qualquer `comissao_percent` salvo no
  // perfil (legado) - sempre retorna percentual=0. Só assessor/comercial
  // expõem o percentual configurado.
  const percentual =
    role === "socio" || role === "coordenador" ? 0 : Number(profile.comissao_percent);
  return {
    valor: valorComissao + fixo,
    valorVariavel: valorComissao,
    baseCalculo,
    fixo,
    percentual,
  };
}

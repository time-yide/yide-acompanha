// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import { isInMonth } from "./date-utils";

export interface ComissaoPrevista {
  valor: number;
  baseCalculo: number;
  fixo: number;
  percentual: number;
}

type Role = "assessor" | "coordenador" | "comercial";

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
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

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

  if (role === "assessor" || role === "coordenador") {
    const filterColumn = role === "assessor" ? "assessor_id" : "coordenador_id";
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, valor_mensal, data_entrada")
      .eq("status", "ativo")
      .eq(filterColumn, userId);

    const clients = (clientsData ?? []) as Array<{ id: string; valor_mensal: number; data_entrada: string }>;

    for (const c of clients) {
      const isPrimeiroMes = isInMonth(c.data_entrada, monthRef);
      const pct = isPrimeiroMes ? profile.comissao_primeiro_mes_percent : profile.comissao_percent;
      const valor = Number(c.valor_mensal);
      baseCalculo += valor;
      valorComissao += valor * (pct / 100);
    }
  } else if (role === "comercial") {
    const inicioMes = `${monthRef}-01`;
    const fimMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);

    const { data: leadsData } = await supabase
      .from("leads")
      .select("id, valor_proposto, data_fechamento")
      .eq("comercial_id", userId)
      .eq("stage", "ativo")
      .gte("data_fechamento", inicioMes)
      .lte("data_fechamento", fimMes);

    const leads = (leadsData ?? []) as Array<{ id: string; valor_proposto: number; data_fechamento: string }>;

    for (const l of leads) {
      const valor = Number(l.valor_proposto);
      baseCalculo += valor;
      valorComissao += valor * (profile.comissao_percent / 100);
    }
  }

  return {
    valor: valorComissao + Number(profile.fixo_mensal),
    baseCalculo,
    fixo: Number(profile.fixo_mensal),
    percentual: Number(profile.comissao_percent),
  };
}

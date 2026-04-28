// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import { isInMonth } from "./date-utils";

export interface LeadsKpis {
  leadsAtivos: number;
  fechamentosMes: number;
  ticketMedio: number;
  taxaConversao: number;
}

interface LeadRow {
  id: string;
  stage: string;
  valor_proposto: number;
  data_fechamento: string | null;
  motivo_perdido: string | null;
  created_at: string;
}

export async function getLeadsKpis(comercialId: string, now: Date = new Date()): Promise<LeadsKpis> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("leads")
    .select("id, stage, valor_proposto, data_fechamento, motivo_perdido, created_at")
    .eq("comercial_id", comercialId);

  const leads = (data ?? []) as LeadRow[];

  const ativos = leads.filter((l) => l.stage !== "ativo" && !l.motivo_perdido).length;
  const fechadosNoMes = leads.filter((l) => l.stage === "ativo" && isInMonth(l.data_fechamento, monthRef));
  const fechamentosMes = fechadosNoMes.length;

  const fechadosUltimos90d = leads.filter(
    (l) => l.stage === "ativo" && l.data_fechamento && l.data_fechamento >= ninetyDaysAgo,
  );
  const ticketMedio =
    fechadosUltimos90d.length > 0
      ? fechadosUltimos90d.reduce((a, l) => a + Number(l.valor_proposto), 0) / fechadosUltimos90d.length
      : 0;

  const criadosUltimos90d = leads.filter((l) => l.created_at.slice(0, 10) >= ninetyDaysAgo);
  const taxaConversao =
    criadosUltimos90d.length > 0 ? (fechadosUltimos90d.length / criadosUltimos90d.length) * 100 : 0;

  return { leadsAtivos: ativos, fechamentosMes, ticketMedio, taxaConversao };
}

export type FunnelStageKey = "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo";

export interface FunnelStage {
  stage: FunnelStageKey;
  label: string;
  count: number;
  totalValor: number;
  taxaConversaoAposEsta: number | null;
}

const STAGE_LABELS: Record<FunnelStageKey, string> = {
  prospeccao: "Prospecção",
  comercial: "Em comercial",
  contrato: "Contrato",
  marco_zero: "Marco zero",
  ativo: "Ativo",
};

export async function getFunnelData(
  comercialId?: string,
  periodMonths: number = 12,
  now: Date = new Date(),
): Promise<FunnelStage[]> {
  const supabase = await createClient();
  const cutoff = new Date(now.getTime() - periodMonths * 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let query = supabase
    .from("leads")
    .select("id, stage, valor_proposto, created_at");
  if (comercialId) {
    query = query.eq("comercial_id", comercialId);
  }
  const { data } = await query.gte("created_at", cutoff);

  const leads = (data ?? []) as Array<{ id: string; stage: FunnelStageKey; valor_proposto: number; created_at: string }>;

  const stages: FunnelStageKey[] = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"];
  const STAGE_INDEX: Record<FunnelStageKey, number> = {
    prospeccao: 0,
    comercial: 1,
    contrato: 2,
    marco_zero: 3,
    ativo: 4,
  };

  return stages.map((stage, i) => {
    const inStage = leads.filter((l) => l.stage === stage);
    const inThisOrLater = leads.filter((l) => STAGE_INDEX[l.stage] >= i);
    const inLater = leads.filter((l) => STAGE_INDEX[l.stage] > i);

    const isLast = i === stages.length - 1;
    const taxaConversaoAposEsta = isLast
      ? null
      : inThisOrLater.length > 0
        ? (inLater.length / inThisOrLater.length) * 100
        : 0;

    return {
      stage,
      label: STAGE_LABELS[stage],
      count: inStage.length,
      totalValor: inStage.reduce((a, l) => a + Number(l.valor_proposto), 0),
      taxaConversaoAposEsta,
    };
  });
}

export interface ProximaReuniao {
  leadId: string;
  nomeProspect: string;
  tipo: "prospeccao_agendada" | "marco_zero";
  data: string; // ISO
}

export async function getProximasReunioes(
  comercialId: string,
  days: number = 14,
  now: Date = new Date(),
): Promise<ProximaReuniao[]> {
  const supabase = await createClient();
  const startIso = now.toISOString();
  const endIso = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("leads")
    .select("id, nome_prospect, data_prospeccao_agendada, data_reuniao_marco_zero")
    .eq("comercial_id", comercialId);

  const leads = (data ?? []) as Array<{
    id: string;
    nome_prospect: string;
    data_prospeccao_agendada: string | null;
    data_reuniao_marco_zero: string | null;
  }>;

  const reunioes: ProximaReuniao[] = [];
  for (const l of leads) {
    if (l.data_prospeccao_agendada && l.data_prospeccao_agendada >= startIso && l.data_prospeccao_agendada <= endIso) {
      reunioes.push({
        leadId: l.id,
        nomeProspect: l.nome_prospect,
        tipo: "prospeccao_agendada",
        data: l.data_prospeccao_agendada,
      });
    }
    if (l.data_reuniao_marco_zero && l.data_reuniao_marco_zero >= startIso && l.data_reuniao_marco_zero <= endIso) {
      reunioes.push({
        leadId: l.id,
        nomeProspect: l.nome_prospect,
        tipo: "marco_zero",
        data: l.data_reuniao_marco_zero,
      });
    }
  }

  reunioes.sort((a, b) => a.data.localeCompare(b.data));
  return reunioes;
}

export interface MetaComercial {
  metaFechamento: number;
  metaComissao: number;
  fechadoMes: number;
  comissaoAtual: number;
  pctMeta: number;
  status: "abaixo" | "no-caminho" | "perto" | "atingido";
}

const META_MULTIPLIER = 3;

export async function getMetaComercial(userId: string, now: Date = new Date()): Promise<MetaComercial> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const inicioMes = `${monthRef}-01`;
  const fimMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("fixo_mensal, comissao_percent, comissao_primeiro_mes_percent")
    .eq("id", userId)
    .single();
  const profile = (profileData as { fixo_mensal: number; comissao_percent: number; comissao_primeiro_mes_percent: number } | null) ?? {
    fixo_mensal: 0,
    comissao_percent: 0,
    comissao_primeiro_mes_percent: 0,
  };

  const fixo = Number(profile.fixo_mensal);
  const pct = Number(profile.comissao_percent);
  const metaComissao = META_MULTIPLIER * fixo;
  const metaFechamento = pct > 0 ? metaComissao / (pct / 100) : 0;

  const { data: leadsData } = await supabase
    .from("leads")
    .select("id, valor_proposto, data_fechamento")
    .eq("comercial_id", userId)
    .eq("stage", "ativo")
    .gte("data_fechamento", inicioMes)
    .lte("data_fechamento", fimMes);

  const fechados = (leadsData ?? []) as Array<{ id: string; valor_proposto: number }>;
  const fechadoMes = fechados.reduce((a, l) => a + Number(l.valor_proposto), 0);
  const comissaoAtual = fechadoMes * (pct / 100);
  const pctMeta = metaFechamento > 0 ? (fechadoMes / metaFechamento) * 100 : 0;

  let status: MetaComercial["status"];
  if (pctMeta >= 100) status = "atingido";
  else if (pctMeta >= 80) status = "perto";
  else if (pctMeta >= 30) status = "no-caminho";
  else status = "abaixo";

  return { metaFechamento, metaComissao, fechadoMes, comissaoAtual, pctMeta, status };
}

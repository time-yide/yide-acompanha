import { createClient } from "@/lib/supabase/server";
import type { Stage } from "./schema";

export interface LeadRow {
  id: string;
  nome_prospect: string;
  site: string | null;
  valor_proposto: number;
  servico_proposto: string | null;
  prioridade: "alta" | "media" | "baixa";
  stage: Stage;
  data_prospeccao_agendada: string | null;
  data_reuniao_marco_zero: string | null;
  data_fechamento: string | null;
  comercial_id: string;
  coord_alocado_id: string | null;
  assessor_alocado_id: string | null;
  comercial_nome?: string | null;
  coord_nome?: string | null;
  assessor_nome?: string | null;
}

export async function listLeadsByStage(): Promise<Record<Stage, LeadRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id, nome_prospect, site, valor_proposto, servico_proposto, prioridade, stage,
      data_prospeccao_agendada, data_reuniao_marco_zero, data_fechamento,
      comercial_id, coord_alocado_id, assessor_alocado_id,
      comercial:profiles!leads_comercial_id_fkey(nome),
      coord:profiles!leads_coord_alocado_id_fkey(nome),
      assessor:profiles!leads_assessor_alocado_id_fkey(nome)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const groups: Record<Stage, LeadRow[]> = {
    leads_potencial: [],
    leads_ativos: [],
    reuniao_comercial: [],
    contrato: [],
    marco_zero: [],
    ativo: [],
  };

  type JoinedRow = typeof data extends (infer U)[] | null ? U : never;
  type WithJoins = JoinedRow & {
    comercial?: { nome: string } | null;
    coord?: { nome: string } | null;
    assessor?: { nome: string } | null;
  };
  for (const r of (data ?? []) as WithJoins[]) {
    // Cast: types do Supabase ainda não conhecem os novos valores do enum lead_stage.
    const row = {
      ...r,
      valor_proposto: Number(r.valor_proposto),
      comercial_nome: r.comercial?.nome ?? null,
      coord_nome: r.coord?.nome ?? null,
      assessor_nome: r.assessor?.nome ?? null,
    } as unknown as LeadRow;
    const stage = r.stage as Stage;
    // Defensivo: leads com valores legados (prospeccao/comercial) caem em
    // leads_ativos/reuniao_comercial caso a migration ainda não tenha rodado.
    if (groups[stage]) {
      groups[stage].push(row);
    } else if (r.stage === "prospeccao") {
      groups.leads_ativos.push(row);
    } else if (r.stage === "comercial") {
      groups.reuniao_comercial.push(row);
    }
  }

  return groups;
}

export async function getLeadById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      comercial:profiles!leads_comercial_id_fkey(id, nome),
      coord:profiles!leads_coord_alocado_id_fkey(id, nome),
      assessor:profiles!leads_assessor_alocado_id_fkey(id, nome),
      cliente:clients(id, nome)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data;
}

export async function listLeadHistory(leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_history")
    .select(`
      id, from_stage, to_stage, observacao, created_at,
      ator:profiles!lead_history_ator_id_fkey(nome)
    `)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listLeadAttempts(leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_attempts")
    .select(`
      id, canal, resultado, observacao, proximo_passo, data_proximo_passo, created_at,
      autor:profiles!lead_attempts_autor_id_fkey(nome)
    `)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

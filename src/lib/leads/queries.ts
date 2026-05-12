import { createClient } from "@/lib/supabase/server";
import type { Stage } from "./schema";

export interface LeadRow {
  id: string;
  nome_prospect: string;
  site: string | null;
  telefone: string | null;
  valor_proposto: number;
  duracao_meses: number | null;
  servico_proposto: string | null;
  link_proposta: string | null;
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
      id, nome_prospect, site, telefone, valor_proposto, duracao_meses, servico_proposto, link_proposta, prioridade, stage,
      data_prospeccao_agendada, data_reuniao_marco_zero, data_fechamento,
      comercial_id, coord_alocado_id, assessor_alocado_id,
      comercial:profiles!leads_comercial_id_fkey(nome),
      coord:profiles!leads_coord_alocado_id_fkey(nome),
      assessor:profiles!leads_assessor_alocado_id_fkey(nome)
    `)
    .is("deleted_at", null)
    // Perdidos saem do kanban e vão pra /onboarding/perdidos.
    .is("motivo_perdido", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const groups: Record<Stage, LeadRow[]> = {
    leads_potencial: [],
    leads_ativos: [],
    reuniao_comercial: [],
    proposta_enviada: [],
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

export interface LeadPerdidoRow extends LeadRow {
  motivo_perdido: string;
  /** updated_at do lead = momento em que foi marcado perdido (markLostAction
   * só toca em motivo_perdido, então o updated_at é fidedigno).
   * Pra um histórico mais granular consultar lead_history separadamente. */
  marcado_perdido_em: string;
}

/**
 * Lista os leads que foram marcados como perdidos (motivo_perdido não-nulo)
 * e ainda não foram deletados. Mais recentes primeiro.
 */
export async function listLeadsPerdidos(): Promise<LeadPerdidoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id, nome_prospect, site, telefone, valor_proposto, duracao_meses, servico_proposto, link_proposta, prioridade, stage,
      data_prospeccao_agendada, data_reuniao_marco_zero, data_fechamento,
      comercial_id, coord_alocado_id, assessor_alocado_id,
      motivo_perdido, updated_at,
      comercial:profiles!leads_comercial_id_fkey(nome),
      coord:profiles!leads_coord_alocado_id_fkey(nome),
      assessor:profiles!leads_assessor_alocado_id_fkey(nome)
    `)
    .is("deleted_at", null)
    .not("motivo_perdido", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  type JoinedRow = typeof data extends (infer U)[] | null ? U : never;
  type WithJoins = JoinedRow & {
    comercial?: { nome: string } | null;
    coord?: { nome: string } | null;
    assessor?: { nome: string } | null;
    motivo_perdido?: string | null;
    updated_at?: string;
  };

  return ((data ?? []) as WithJoins[]).map((r) => ({
    ...r,
    valor_proposto: Number(r.valor_proposto),
    comercial_nome: r.comercial?.nome ?? null,
    coord_nome: r.coord?.nome ?? null,
    assessor_nome: r.assessor?.nome ?? null,
    motivo_perdido: r.motivo_perdido ?? "",
    marcado_perdido_em: r.updated_at ?? "",
  })) as unknown as LeadPerdidoRow[];
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

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
    .order("created_at", { ascending: false });

  if (error) throw error;

  const groups: Record<Stage, LeadRow[]> = {
    prospeccao: [], comercial: [], contrato: [], marco_zero: [], ativo: [],
  };

  for (const r of data ?? []) {
    const row: LeadRow = {
      ...r,
      valor_proposto: Number(r.valor_proposto),
      comercial_nome: (r as any).comercial?.nome ?? null,
      coord_nome: (r as any).coord?.nome ?? null,
      assessor_nome: (r as any).assessor?.nome ?? null,
    };
    groups[r.stage as Stage].push(row);
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

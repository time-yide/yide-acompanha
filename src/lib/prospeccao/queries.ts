// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";

export type ProspectStatus = "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo" | "perdido";

export interface ProspectsFilter {
  comercialId?: string;          // se não passado, retorna todos (Sócio/ADM)
  status?: ProspectStatus[];     // multi-select
  valorMin?: number;
  valorMax?: number;
  ultimoContatoApos?: string;    // 'YYYY-MM-DD'
}

export interface ProspectListRow {
  id: string;
  nome_prospect: string;
  site: string | null;
  contato_principal: string | null;
  stage: "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo";
  valor_proposto: number;
  comercial_id: string;
  motivo_perdido: string | null;
  data_fechamento: string | null;
  prioridade: "alta" | "media" | "baixa";
  created_at: string;
  comercial: { nome: string } | null;
  ultimo_attempt_at: string | null;
}

export async function getProspectsList(filter: ProspectsFilter = {}): Promise<ProspectListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("id, nome_prospect, site, contato_principal, stage, valor_proposto, comercial_id, motivo_perdido, data_fechamento, prioridade, created_at, comercial:profiles!leads_comercial_id_fkey(nome)");

  if (filter.comercialId) {
    query = query.eq("comercial_id", filter.comercialId);
  }

  const { data } = await query;
  let rows = (data ?? []) as unknown as ProspectListRow[];

  // Filtro de status (com 'perdido' como pseudo-status)
  if (filter.status && filter.status.length > 0) {
    rows = rows.filter((r) => {
      if (filter.status!.includes("perdido") && r.motivo_perdido) return true;
      return filter.status!.includes(r.stage as ProspectStatus) && !r.motivo_perdido;
    });
  }

  // Filtro de valor
  if (filter.valorMin !== undefined) {
    rows = rows.filter((r) => Number(r.valor_proposto) >= filter.valorMin!);
  }
  if (filter.valorMax !== undefined) {
    rows = rows.filter((r) => Number(r.valor_proposto) <= filter.valorMax!);
  }

  // ultimoContatoApos: feature deferida (sem query do último attempt agora)

  return rows;
}

export interface ProspectDetail {
  id: string;
  nome_prospect: string;
  site: string | null;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  stage: "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo";
  valor_proposto: number;
  comercial_id: string;
  motivo_perdido: string | null;
  data_fechamento: string | null;
  data_prospeccao_agendada: string | null;
  data_reuniao_marco_zero: string | null;
  duracao_meses: number | null;
  servico_proposto: string | null;
  prioridade: "alta" | "media" | "baixa";
  info_briefing: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  comercial: { nome: string; email: string } | null;
}

export async function getProspectDetail(leadId: string): Promise<ProspectDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, nome_prospect, site, contato_principal, email, telefone, stage, valor_proposto, comercial_id, motivo_perdido, data_fechamento, data_prospeccao_agendada, data_reuniao_marco_zero, duracao_meses, servico_proposto, prioridade, info_briefing, client_id, created_at, updated_at, comercial:profiles!leads_comercial_id_fkey(nome, email)")
    .eq("id", leadId)
    .single();
  return (data as unknown as ProspectDetail | null) ?? null;
}

export interface LeadAttemptRow {
  id: string;
  lead_id: string;
  canal: "whatsapp" | "email" | "ligacao" | "presencial" | "outro";
  resultado: "sem_resposta" | "agendou" | "recusou" | "pediu_proposta" | "outro";
  observacao: string | null;
  proximo_passo: string | null;
  data_proximo_passo: string | null;
  created_at: string;
  autor_id: string;
  autor: { nome: string } | null;
}

export async function getLeadAttempts(leadId: string): Promise<LeadAttemptRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_attempts")
    .select("id, lead_id, canal, resultado, observacao, proximo_passo, data_proximo_passo, created_at, autor_id, autor:profiles!lead_attempts_autor_id_fkey(nome)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as LeadAttemptRow[];
}

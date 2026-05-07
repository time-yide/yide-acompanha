// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const RETENCAO_DIAS = 30;

export interface DeletedClienteRow {
  id: string;
  nome: string;
  status: string | null;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_nome: string | null;
}

export interface DeletedLeadRow {
  id: string;
  nome_prospect: string;
  stage: string | null;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_nome: string | null;
}

export interface DeletedTaskRow {
  id: string;
  titulo: string;
  status: string | null;
  client_id: string | null;
  cliente_nome: string | null;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_nome: string | null;
}

function cutoffIso(): string {
  return new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

export async function listDeletedClientes(): Promise<DeletedClienteRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("clients")
    .select(`
      id, nome, status, deleted_at, deleted_by,
      deleted_by_profile:profiles!clients_deleted_by_fkey(nome)
    `)
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoffIso())
    .order("deleted_at", { ascending: false });
  return ((data ?? []) as Array<{
    id: string;
    nome: string;
    status: string | null;
    deleted_at: string;
    deleted_by: string | null;
    deleted_by_profile: { nome: string } | null;
  }>).map((r) => ({
    id: r.id,
    nome: r.nome,
    status: r.status,
    deleted_at: r.deleted_at,
    deleted_by: r.deleted_by,
    deleted_by_nome: r.deleted_by_profile?.nome ?? null,
  }));
}

export async function listDeletedLeads(): Promise<DeletedLeadRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("leads")
    .select(`
      id, nome_prospect, stage, deleted_at, deleted_by,
      deleted_by_profile:profiles!leads_deleted_by_fkey(nome)
    `)
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoffIso())
    .order("deleted_at", { ascending: false });
  return ((data ?? []) as Array<{
    id: string;
    nome_prospect: string;
    stage: string | null;
    deleted_at: string;
    deleted_by: string | null;
    deleted_by_profile: { nome: string } | null;
  }>).map((r) => ({
    id: r.id,
    nome_prospect: r.nome_prospect,
    stage: r.stage,
    deleted_at: r.deleted_at,
    deleted_by: r.deleted_by,
    deleted_by_nome: r.deleted_by_profile?.nome ?? null,
  }));
}

export async function listDeletedTasks(): Promise<DeletedTaskRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("tasks")
    .select(`
      id, titulo, status, client_id, deleted_at, deleted_by,
      cliente:clients(nome),
      deleted_by_profile:profiles!tasks_deleted_by_fkey(nome)
    `)
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoffIso())
    .order("deleted_at", { ascending: false });
  return ((data ?? []) as Array<{
    id: string;
    titulo: string;
    status: string | null;
    client_id: string | null;
    cliente: { nome: string } | null;
    deleted_at: string;
    deleted_by: string | null;
    deleted_by_profile: { nome: string } | null;
  }>).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    status: r.status,
    client_id: r.client_id,
    cliente_nome: r.cliente?.nome ?? null,
    deleted_at: r.deleted_at,
    deleted_by: r.deleted_by,
    deleted_by_nome: r.deleted_by_profile?.nome ?? null,
  }));
}

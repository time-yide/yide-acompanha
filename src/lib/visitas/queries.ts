// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface VisitaRow {
  id: string;
  data: string;
  titulo: string;
  bairro: string | null;
  cidade: string | null;
  observacoes: string | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  total_leads: number;
  created_at: string;
}

export async function listVisitas(organizationId: string): Promise<VisitaRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("visitas")
    .select(
      "id, data, titulo, bairro, cidade, observacoes, colaborador_id, created_at, colaborador:profiles!visitas_colaborador_id_fkey(nome), leads:leads_gerados(count)",
    )
    .eq("organization_id", organizationId)
    .is("arquivado_em", null)
    .order("data", { ascending: false });
  if (error) {
    console.error("[visitas] list", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    data: row.data as string,
    titulo: row.titulo as string,
    bairro: (row.bairro as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    colaborador_id: (row.colaborador_id as string | null) ?? null,
    colaborador_nome:
      ((row.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    total_leads: Array.isArray(row.leads)
      ? Number((row.leads[0] as { count?: number })?.count ?? 0)
      : 0,
    created_at: row.created_at as string,
  }));
}

export async function getVisita(
  organizationId: string,
  id: string,
): Promise<VisitaRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("visitas")
    .select(
      "id, data, titulo, bairro, cidade, observacoes, colaborador_id, created_at, colaborador:profiles!visitas_colaborador_id_fkey(nome)",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("arquivado_em", null)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    data: row.data as string,
    titulo: row.titulo as string,
    bairro: (row.bairro as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    colaborador_id: (row.colaborador_id as string | null) ?? null,
    colaborador_nome:
      ((row.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    total_leads: 0,
    created_at: row.created_at as string,
  };
}

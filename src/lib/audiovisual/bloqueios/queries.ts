import { createClient } from "@/lib/supabase/server";

export const BLOQUEIOS_TAG = "agenda_bloqueios";

export interface BloqueioRow {
  id: string;
  criado_por: string;
  criado_por_nome: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  motivo: string;
  status: "pendente" | "aprovada" | "rejeitada";
  respondido_por: string | null;
  respondido_em: string | null;
  motivo_recusa: string | null;
  created_at: string;
}

const SELECT =
  "id, criado_por, criado_por_nome, data, hora_inicio, hora_fim, motivo, status, respondido_por, respondido_em, motivo_recusa, created_at";

export async function listMeusBloqueios(userId: string): Promise<BloqueioRow[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("agenda_bloqueios")
    .select(SELECT)
    .eq("criado_por", userId)
    .is("deleted_at", null)
    .order("data", { ascending: false });
  return (data ?? []) as BloqueioRow[];
}

export async function listBloqueiosPendentes(): Promise<BloqueioRow[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("agenda_bloqueios")
    .select(SELECT)
    .eq("status", "pendente")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as BloqueioRow[];
}

export async function listBloqueiosRespondidos(limit = 30): Promise<BloqueioRow[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("agenda_bloqueios")
    .select(SELECT)
    .neq("status", "pendente")
    .is("deleted_at", null)
    .order("respondido_em", { ascending: false })
    .limit(limit);
  return (data ?? []) as BloqueioRow[];
}

/** Bloqueios APROVADOS de um videomaker numa data local (YYYY-MM-DD). */
export async function listBloqueiosAprovadosNaData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  videomakerId: string,
  dataLocal: string,
): Promise<{ hora_inicio: string; hora_fim: string; motivo: string }[]> {
  const { data } = await sb
    .from("agenda_bloqueios")
    .select("hora_inicio, hora_fim, motivo")
    .eq("criado_por", videomakerId)
    .eq("status", "aprovada")
    .eq("data", dataLocal)
    .is("deleted_at", null);
  return data ?? [];
}

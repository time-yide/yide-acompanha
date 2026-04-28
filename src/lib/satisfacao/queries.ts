import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SatisfactionColor } from "./schema";
import type { Database } from "@/types/database";

type RoleEnum = Database["public"]["Enums"]["user_role"];

interface ClienteRow {
  id: string;
  nome: string;
  assessor_id: string | null;
  coordenador_id: string | null;
}

/**
 * Lista clientes que o user pode/deve avaliar nesta semana.
 * - Coord/Sócio/ADM/Audiovisual Chefe/Produtores: todos clientes ativos.
 * - Assessor: só os clientes onde é assessor.
 * - Outros: vazio.
 */
export async function listClientsForUser(userId: string, role: RoleEnum): Promise<ClienteRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, nome, assessor_id, coordenador_id")
    .eq("status", "ativo")
    .order("nome");

  if (role === "assessor") {
    query = query.eq("assessor_id", userId);
  } else if (!["socio", "adm", "coordenador", "audiovisual_chefe", "videomaker", "designer", "editor"].includes(role)) {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ClienteRow[];
}

export interface EntryRow {
  id: string;
  client_id: string;
  autor_id: string;
  papel_autor: string;
  semana_iso: string;
  cor: SatisfactionColor | null;
  comentario: string | null;
}

export async function listEntriesForUserWeek(userId: string, weekIso: string): Promise<EntryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("satisfaction_entries")
    .select("id, client_id, autor_id, papel_autor, semana_iso, cor, comentario")
    .eq("autor_id", userId)
    .eq("semana_iso", weekIso);
  if (error) throw error;
  return (data ?? []) as EntryRow[];
}

export async function listEntriesForClientWeek(clientId: string, weekIso: string): Promise<EntryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("satisfaction_entries")
    .select("id, client_id, autor_id, papel_autor, semana_iso, cor, comentario, autor:profiles!satisfaction_entries_autor_id_fkey(nome)")
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso);
  if (error) throw error;
  return (data ?? []) as unknown as EntryRow[];
}

export interface SynthesisRow {
  id: string;
  client_id: string;
  semana_iso: string;
  score_final: number;
  cor_final: SatisfactionColor;
  resumo_ia: string;
  divergencia_detectada: boolean;
  acao_sugerida: string | null;
  created_at: string;
}

export async function getSynthesis(clientId: string, weekIso: string): Promise<SynthesisRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("satisfaction_synthesis")
    .select("*")
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .maybeSingle();
  return (data as SynthesisRow | null) ?? null;
}

export async function getSynthesisHistory(clientId: string, limit = 12): Promise<SynthesisRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("satisfaction_synthesis")
    .select("*")
    .eq("client_id", clientId)
    .order("semana_iso", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SynthesisRow[];
}

export async function getSynthesisForWeek(weekIso: string): Promise<Array<SynthesisRow & { cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("satisfaction_synthesis")
    .select("*, cliente:clients(nome, assessor_id, coordenador_id)")
    .eq("semana_iso", weekIso);
  if (error) throw error;
  return (data ?? []) as unknown as Array<SynthesisRow & { cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null }>;
}

/**
 * Conta entries com cor preenchida pra um cliente em uma semana.
 * Usada pelo trigger real-time pra saber quando disparar a síntese.
 * Usa service-role pra ter visão completa (todas avaliações independente do user).
 */
export async function countFilledEntries(clientId: string, weekIso: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("satisfaction_entries")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .not("cor", "is", null);
  return count ?? 0;
}

/**
 * Lista clientes com entries preenchidas mas sem síntese ainda nesta semana.
 * Usado pelo cron quinta-feira pra rodar IA em quem ficou pendente.
 */
export async function listClientsWithEntriesButNoSynthesis(weekIso: string): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data: filledEntries } = await supabase
    .from("satisfaction_entries")
    .select("client_id")
    .eq("semana_iso", weekIso)
    .not("cor", "is", null);
  const clientIdsWithEntries = new Set<string>(
    ((filledEntries ?? []) as Array<{ client_id: string }>).map((e) => e.client_id),
  );
  if (clientIdsWithEntries.size === 0) return [];

  const { data: synth } = await supabase
    .from("satisfaction_synthesis")
    .select("client_id")
    .eq("semana_iso", weekIso);
  const clientsWithSynth = new Set<string>(
    ((synth ?? []) as Array<{ client_id: string }>).map((s) => s.client_id),
  );

  return [...clientIdsWithEntries].filter((id) => !clientsWithSynth.has(id));
}

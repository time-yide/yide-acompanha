import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ContentCalendarRow } from "./types";

export async function getCalendarByClientMonth(
  clientId: string,
  mesReferencia: string,
): Promise<ContentCalendarRow | null> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("content_calendars")
    .select("*")
    .eq("client_id", clientId)
    .eq("mes_referencia", mesReferencia)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as ContentCalendarRow | null;
}

export async function listCalendarsByAssessor(
  assessorId: string,
  mesReferencia: string,
): Promise<(ContentCalendarRow & { client_nome: string })[]> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("content_calendars")
    .select("*, clients!inner(nome, assessor_id)")
    .eq("clients.assessor_id", assessorId)
    .eq("mes_referencia", mesReferencia)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    client_nome: row.clients.nome,
    clients: undefined,
  }));
}

export async function listPendingCalendars(
  limit: number = 3,
): Promise<ContentCalendarRow[]> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("content_calendars")
    .select("*")
    .eq("status", "pendente_geracao")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ContentCalendarRow[];
}

export interface CalendarOverviewRow {
  id: string;
  client_id: string;
  client_nome: string;
  tipo_pacote: string;
  mes_referencia: string;
  modo: ContentCalendarRow["modo"];
  status: ContentCalendarRow["status"];
  posts_count: number;
  aprovado_em: string | null;
  erro_msg: string | null;
  updated_at: string;
}

export async function listAllCalendarsForMonth(
  mesReferencia: string,
  clientIds: string[] | null,
): Promise<CalendarOverviewRow[]> {
  if (clientIds !== null && clientIds.length === 0) return [];

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sbAny
    .from("content_calendars")
    .select("id, client_id, mes_referencia, modo, status, posts_json, aprovado_em, erro_msg, updated_at, clients!inner(nome, tipo_pacote)")
    .eq("mes_referencia", mesReferencia);

  if (clientIds !== null) {
    q = q.in("client_id", clientIds);
  }

  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    client_id: row.client_id,
    client_nome: row.clients?.nome ?? "",
    tipo_pacote: row.clients?.tipo_pacote ?? "",
    mes_referencia: row.mes_referencia,
    modo: row.modo,
    status: row.status,
    posts_count: Array.isArray(row.posts_json) ? row.posts_json.length : 0,
    aprovado_em: row.aprovado_em,
    erro_msg: row.erro_msg,
    updated_at: row.updated_at,
  }));
}

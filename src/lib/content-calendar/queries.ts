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

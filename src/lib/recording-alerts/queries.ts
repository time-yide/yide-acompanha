import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { AlertWithClient } from "./types";

export async function listAlertsByStatus(
  orgId: string,
  status: string | string[],
): Promise<AlertWithClient[]> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const statuses = Array.isArray(status) ? status : [status];
  const { data, error } = await sbAny
    .from("recording_scheduling_alerts")
    .select("*, clients!inner(nome, assessor_id)")
    .eq("organization_id", orgId)
    .in("status", statuses)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    client_nome: row.clients.nome,
    assessor_id: row.clients.assessor_id,
    clients: undefined,
  }));
}

export async function listAlertsByAssessor(
  assessorId: string,
  status: string = "pendente",
): Promise<AlertWithClient[]> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("recording_scheduling_alerts")
    .select("*, clients!inner(nome, assessor_id)")
    .eq("clients.assessor_id", assessorId)
    .eq("status", status)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    client_nome: row.clients.nome,
    assessor_id: row.clients.assessor_id,
    clients: undefined,
  }));
}

export async function getAlertById(alertId: string) {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("recording_scheduling_alerts")
    .select("*, clients!inner(nome, organization_id, assessor_id)")
    .eq("id", alertId)
    .single();
  if (error) throw error;
  return data;
}

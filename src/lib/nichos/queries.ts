import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { NichoRow } from "./schema";

export async function listNichos(orgId: string): Promise<NichoRow[]> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("nichos")
    .select("*")
    .eq("organization_id", orgId)
    .order("nome");
  if (error) throw error;
  return (data as unknown as NichoRow[]) ?? [];
}

export async function getNicho(id: string): Promise<NichoRow | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("nichos")
    .select("*")
    .eq("id", id)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as unknown as NichoRow | null;
}

export async function getNichoByClientId(
  clientId: string
): Promise<NichoRow | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("clients")
    .select("nicho_id, nichos(*)")
    .eq("id", clientId)
    .single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  if (!row?.nichos) return null;
  return row.nichos as unknown as NichoRow;
}

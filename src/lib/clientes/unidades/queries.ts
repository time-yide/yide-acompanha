import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ClientUnitRow } from "./schema";

/**
 * Lista todas as unidades de um cliente, ativas + inativas. Ordena por nome.
 * Service-role pra bypassar RLS — caller decide se filtra ativas.
 */
export async function listUnidadesByClient(clientId: string): Promise<ClientUnitRow[]> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("client_units")
    .select("id, client_id, nome, endereco, drive_url, observacoes, ativo, created_at, updated_at")
    .eq("client_id", clientId)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClientUnitRow[];
}

/**
 * Lista APENAS unidades ativas. Usado pelo portal do cliente (não quer mostrar
 * filial fechada/inativa).
 */
export async function listUnidadesAtivasByClient(clientId: string): Promise<ClientUnitRow[]> {
  const all = await listUnidadesByClient(clientId);
  return all.filter((u) => u.ativo);
}

export async function getUnidadeById(id: string): Promise<ClientUnitRow | null> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data, error } = await sbAny
    .from("client_units")
    .select("id, client_id, nome, endereco, drive_url, observacoes, ativo, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientUnitRow | null) ?? null;
}

// SERVER ONLY
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { podeGerenciarAcessosInternos } from "./access";
import type { InternalVisibility } from "./schema";

export interface AcessoInternoRow {
  id: string;
  service_name: string;
  username: string | null;
  notes: string | null;
  visibility: InternalVisibility;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** Lista os acessos internos visíveis pro papel — sem a senha. Gestão vê tudo;
 *  o time só os de visibilidade "time". */
export async function listAcessosInternos(role: string): Promise<AcessoInternoRow[]> {
  const sb = createServiceRoleClient() as SB;
  let q = sb
    .from("internal_credentials")
    .select("id, service_name, username, notes, visibility, updated_at")
    .order("service_name");
  if (!podeGerenciarAcessosInternos(role)) q = q.eq("visibility", "time");
  const { data } = await q;
  return (data ?? []) as AcessoInternoRow[];
}

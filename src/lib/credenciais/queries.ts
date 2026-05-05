// SERVER ONLY: não importar de Client Components
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLES_PODEM_ACESSAR_CREDENCIAIS } from "./schema";

export interface CredentialRow {
  id: string;
  client_id: string;
  service_name: string;
  username: string | null;
  // password_encrypted NUNCA volta pra UI — só decryptado via revealPasswordAction.
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  // Nomes resolvidos (joinados de profiles)
  created_by_nome?: string | null;
  updated_by_nome?: string | null;
}

export interface AccessLogRow {
  id: string;
  credential_id: string;
  client_id: string;
  user_id: string;
  user_nome: string | null;
  service_name: string;
  action: "view" | "create" | "update" | "delete";
  accessed_at: string;
}

/**
 * Verifica se o usuário pode acessar credenciais do cliente especificado.
 * - socio/adm: tudo
 * - assessor/coordenador: só clientes onde é responsável (assessor_id ou coordenador_id)
 * - outros: não
 */
export async function canAccessClientCredentials(params: {
  userId: string;
  userRole: string;
  clientId: string;
}): Promise<boolean> {
  if (!(ROLES_PODEM_ACESSAR_CREDENCIAIS as readonly string[]).includes(params.userRole)) {
    return false;
  }
  if (params.userRole === "socio" || params.userRole === "adm") {
    return true;
  }
  // assessor/coordenador: confirma que é responsável pelo cliente
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("clients")
    .select("assessor_id, coordenador_id")
    .eq("id", params.clientId)
    .single();
  if (!data) return false;
  return data.assessor_id === params.userId || data.coordenador_id === params.userId;
}

// Tabelas novas ainda não estão em src/types/database.ts. Casts via `as never`
// no nome da tabela + `as unknown as <T>` nos retornos. Após `npm run db:types`
// pós-merge, esses casts ficam redundantes e podem ser removidos.

export async function listCredentialsByClient(clientId: string): Promise<CredentialRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("client_credentials" as never) as any)
    .select(
      "id, client_id, service_name, username, notes, created_at, updated_at, created_by, updated_by, created_by_profile:profiles!client_credentials_created_by_fkey(nome), updated_by_profile:profiles!client_credentials_updated_by_fkey(nome)",
    )
    .eq("client_id", clientId)
    .order("service_name", { ascending: true });

  return ((data ?? []) as Array<{
    id: string;
    client_id: string;
    service_name: string;
    username: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    updated_by: string | null;
    created_by_profile: { nome: string } | null;
    updated_by_profile: { nome: string } | null;
  }>).map((r) => ({
    id: r.id,
    client_id: r.client_id,
    service_name: r.service_name,
    username: r.username,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    created_by: r.created_by,
    updated_by: r.updated_by,
    created_by_nome: r.created_by_profile?.nome ?? null,
    updated_by_nome: r.updated_by_profile?.nome ?? null,
  }));
}

export async function getCredentialEncryptedById(
  credentialId: string,
): Promise<{ id: string; client_id: string; service_name: string; password_encrypted: string } | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("client_credentials" as never) as any)
    .select("id, client_id, service_name, password_encrypted")
    .eq("id", credentialId)
    .single();
  return (data as { id: string; client_id: string; service_name: string; password_encrypted: string } | null) ?? null;
}

export async function listAccessLogByCredential(credentialId: string): Promise<AccessLogRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("credential_access_log" as never) as any)
    .select(
      "id, credential_id, client_id, user_id, action, accessed_at, user_profile:profiles!credential_access_log_user_id_fkey(nome), credential:client_credentials(service_name)",
    )
    .eq("credential_id", credentialId)
    .order("accessed_at", { ascending: false })
    .limit(100);

  return ((data ?? []) as Array<{
    id: string;
    credential_id: string;
    client_id: string;
    user_id: string;
    action: "view" | "create" | "update" | "delete";
    accessed_at: string;
    user_profile: { nome: string } | null;
    credential: { service_name: string } | null;
  }>).map((r) => ({
    id: r.id,
    credential_id: r.credential_id,
    client_id: r.client_id,
    user_id: r.user_id,
    user_nome: r.user_profile?.nome ?? null,
    service_name: r.credential?.service_name ?? "—",
    action: r.action,
    accessed_at: r.accessed_at,
  }));
}

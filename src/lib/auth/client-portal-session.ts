import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Sessão do cliente final (portal externo `/cliente`). Distinto de
 * `getCurrentUser()` em `session.ts` (esse é só pra colab interno).
 *
 * Auth.users compartilhada com a equipe - diferenciação é via tabela:
 * - `profiles` → colaborador interno
 * - `client_portal_users` → cliente final
 *
 * Cada auth.user pertence a uma única tabela (validado na criação).
 */
export interface ClientPortalUser {
  userId: string;
  email: string;
  clientId: string;
  clientNome: string;
  nomeContato: string | null;
}

/**
 * Memoizado com React.cache - uma só ida ao Supabase por render, mesmo se
 * chamado várias vezes (layout + page + childs).
 */
export const getClientPortalUser = cache(async (): Promise<ClientPortalUser | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  // service-role pra bypassar RLS na validação (mais rápido e seguro do
  // que depender de RLS pra essa lookup específica).
  const sb = createServiceRoleClient();
  const { data: portalUser } = await sb
    .from("client_portal_users")
    .select("user_id, client_id, nome_contato, ativo, client:clients(nome)")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .single();

  if (!portalUser) return null;
  const client = portalUser.client as { nome: string } | null;
  if (!client) return null;

  return {
    userId: portalUser.user_id,
    email: user.email,
    clientId: portalUser.client_id,
    clientNome: client.nome,
    nomeContato: portalUser.nome_contato ?? null,
  };
});

export async function requireClientPortalAuth(): Promise<ClientPortalUser> {
  const user = await getClientPortalUser();
  if (!user) redirect("/cliente/login");
  return user;
}

/**
 * Helper inverso usado por `getCurrentUser` (colab interno) pra REJEITAR
 * sessões que pertencem ao portal cliente. Evita cliente final entrar
 * acidentalmente como colab.
 */
export async function isAuthUserAClientPortalUser(userId: string): Promise<boolean> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("client_portal_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

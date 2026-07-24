import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role, Action } from "@/lib/auth/permissions";
import { canAccess } from "@/lib/auth/permissions";
import { isAuthUserAClientPortalUser } from "@/lib/auth/client-portal-session";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  nome: string;
  ativo: boolean;
  avatarUrl: string | null;
  /** Especialidade do assessor (ex: "ecommerce"). Livre, pode ser null. */
  especialidade: string | null;
};

/**
 * Memoizado com `React.cache` - dentro do MESMO render (layout + page + childs),
 * uma só chamada pro Supabase (`auth.getUser` + `select profiles`), mesmo que
 * `requireAuth()` seja chamado 3-4 vezes. Não persiste entre requests.
 *
 * Retorna null se o auth.user pertence ao portal do cliente (`client_portal_users`).
 * Isso garante isolamento: cliente final nunca consegue acessar rotas internas
 * mesmo que tenha sessão Supabase ativa.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // `especialidade` ainda não está nos tipos gerados do Supabase → cast via any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // As duas checagens (é cliente-portal? + perfil interno) são independentes:
  // roda EM PARALELO pra não pagar 2 round-trips sequenciais em toda página.
  const [isPortal, profileRes] = await Promise.all([
    isAuthUserAClientPortalUser(user.id),
    sb
      .from("profiles")
      .select("id, email, role, nome, ativo, avatar_url, especialidade")
      .eq("id", user.id)
      .single(),
  ]);

  // Bloqueia cliente portal de entrar como colab. Mesmo que ele acidentalmente
  // tenha cookie pra essa rota, getCurrentUser() retorna null → redirect /login.
  if (isPortal) return null;

  const profile = profileRes.data;
  if (!profile || !profile.ativo) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as Role,
    nome: profile.nome,
    ativo: profile.ativo,
    avatarUrl: profile.avatar_url,
    especialidade: (profile.especialidade as string | null) ?? null,
  };
});

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(action: Action): Promise<CurrentUser> {
  const user = await requireAuth();
  if (!canAccess(user.role, action)) {
    redirect("/?error=forbidden");
  }
  return user;
}

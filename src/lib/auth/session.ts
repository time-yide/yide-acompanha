import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role, Action } from "@/lib/auth/permissions";
import { canAccess } from "@/lib/auth/permissions";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  nome: string;
  ativo: boolean;
  avatarUrl: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, nome, ativo, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.ativo) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as Role,
    nome: profile.nome,
    ativo: profile.ativo,
    avatarUrl: profile.avatar_url,
  };
}

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

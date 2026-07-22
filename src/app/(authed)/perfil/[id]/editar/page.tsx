import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CapaUpload } from "@/components/perfil/CapaUpload";
import { EditarCardForm } from "@/components/perfil/EditarCardForm";
import type { PerfilJogador } from "@/lib/perfil-jogador/schema";

export default async function EditarPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (user.id !== id && !canAccess(user.role, "manage:users")) redirect(`/perfil/${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: prof } = await sb.from("profiles").select("id, nome").eq("id", id).single();
  if (!prof) notFound();
  const { data: perfilRow } = await sb
    .from("perfil_jogador")
    .select("user_id, username, capa_url, bio, como_trabalho, hobbies, frase")
    .eq("user_id", id)
    .maybeSingle();
  const perfil = (perfilRow as PerfilJogador | null) ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Editar card</h1>
        <p className="text-sm text-muted-foreground">{prof.nome}</p>
      </header>
      <CapaUpload userId={id} currentUrl={perfil?.capa_url ?? null} />
      <EditarCardForm userId={id} perfil={perfil} />
    </div>
  );
}

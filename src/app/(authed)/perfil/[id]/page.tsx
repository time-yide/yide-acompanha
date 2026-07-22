import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getCard } from "@/lib/perfil-jogador/queries";
import { CardJogador } from "@/components/perfil/CardJogador";

export default async function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const card = await getCard(id);
  if (!card) notFound();
  const podeEditar = user.id === id || canAccess(user.role, "manage:users");
  return (
    <div className="mx-auto max-w-2xl">
      <CardJogador card={card} podeEditar={podeEditar} />
    </div>
  );
}

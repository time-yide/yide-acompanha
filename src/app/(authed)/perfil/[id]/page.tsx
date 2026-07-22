import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getCard } from "@/lib/perfil-jogador/queries";
import { getConquistasDoUsuario, type ConquistaCard } from "@/lib/conquistas/queries";
import { sincronizarConquistasAction, type ConquistaNova } from "@/lib/conquistas/actions";
import { CardJogador } from "@/components/perfil/CardJogador";
import { ConquistaToast } from "@/components/perfil/ConquistaToast";

export default async function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const card = await getCard(id);
  if (!card) notFound();
  const podeEditar = user.id === id || canAccess(user.role, "manage:users");

  // Dono: sincroniza (grava novas) e comemora, coletando os stats uma única vez.
  // Terceiros: só listam. Ambos usam o role do DONO (id), não o do viewer.
  let novas: ConquistaNova[] = [];
  let conquistas: ConquistaCard[];
  if (user.id === id) {
    ({ novas, conquistas } = await sincronizarConquistasAction(id));
  } else {
    conquistas = await getConquistasDoUsuario(id, card.roleDoUsuario);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {novas.length > 0 && <ConquistaToast novas={novas} />}
      <CardJogador card={card} podeEditar={podeEditar} conquistas={conquistas} />
    </div>
  );
}

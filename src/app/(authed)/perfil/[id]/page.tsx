import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getCard } from "@/lib/perfil-jogador/queries";
import { getStatsDoUsuario } from "@/lib/conquistas/stats";
import { getConquistasDoUsuario, type ConquistaCard } from "@/lib/conquistas/queries";
import { sincronizarConquistasAction, type ConquistaNova } from "@/lib/conquistas/actions";
import { getSkillsDoUsuario } from "@/lib/skills/queries";
import { CardJogador } from "@/components/perfil/CardJogador";
import { ConquistaToast } from "@/components/perfil/ConquistaToast";

export default async function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const card = await getCard(id);
  if (!card) notFound();
  const podeEditar = user.id === id || canAccess(user.role, "manage:users");

  const stats = await getStatsDoUsuario(id, card.roleDoUsuario);

  let novas: ConquistaNova[] = [];
  let conquistas: ConquistaCard[];
  if (user.id === id) {
    const r = await sincronizarConquistasAction(id, stats);
    novas = r.novas;
    conquistas = r.conquistas;
  } else {
    conquistas = await getConquistasDoUsuario(id, card.roleDoUsuario, stats);
  }

  const skills = await getSkillsDoUsuario(id, card.roleDoUsuario, card.classe, stats);

  return (
    <div className="mx-auto max-w-2xl">
      {novas.length > 0 && <ConquistaToast novas={novas} />}
      <CardJogador card={card} podeEditar={podeEditar} conquistas={conquistas} skills={skills} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId, listOportunidades, listMinhas, listCriadasPorMim, getRanking, getHistorico, getMetaAtual, getStats } from "@/lib/freela-yide/queries";
import { FreelaHero } from "@/components/freela-yide/FreelaHero";
import { MetaCard } from "@/components/freela-yide/MetaCard";
import { OportunidadesGrid } from "@/components/freela-yide/OportunidadesGrid";
import { MinhasOportunidades } from "@/components/freela-yide/MinhasOportunidades";
import { ResumoSubidos } from "@/components/freela-yide/ResumoSubidos";
import { RankingPainel } from "@/components/freela-yide/RankingPainel";
import { NovaOportunidadeButton } from "@/components/freela-yide/NovaOportunidadeButton";
import { DefinirMetaButton } from "@/components/freela-yide/DefinirMetaButton";

const ALLOWED = ["adm", "socio", "comercial", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"];
const GESTAO = ["adm", "socio"];

export default async function FreelaYidePage() {
  const user = await requireAuth();
  if (!ALLOWED.includes(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const gestao = GESTAO.includes(user.role);

  const [todas, minhas, criadas, ranking, historico, meta, stats] = await Promise.all([
    listOportunidades(orgId, true),
    listMinhas(orgId, user.id),
    gestao ? listCriadasPorMim(orgId, user.id) : Promise.resolve([]),
    getRanking(orgId),
    getHistorico(orgId),
    getMetaAtual(orgId),
    getStats(orgId, user.id),
  ]);

  return (
    <div className="space-y-6">
      <FreelaHero stats={stats} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Oportunidades disponíveis</h2>
              {gestao && <NovaOportunidadeButton />}
            </div>
            <OportunidadesGrid ops={todas} gestao={gestao} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Minhas oportunidades</h2>
            <MinhasOportunidades ops={minhas} />
          </section>

          {gestao && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Que eu subi</h2>
              <ResumoSubidos ops={criadas} />
              <OportunidadesGrid ops={criadas} gestao={gestao} />
            </section>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ranking</h2>
            {gestao && <DefinirMetaButton />}
          </div>
          <MetaCard meta={meta} ranking={ranking} />
          <RankingPainel historico={historico} meId={user.id} />
        </div>
      </div>
    </div>
  );
}

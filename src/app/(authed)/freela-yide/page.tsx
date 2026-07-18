import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId, listOportunidades, listMinhas, getRanking, getHistorico, getMetaAtual, getStats } from "@/lib/freela-yide/queries";
import { FreelaHero } from "@/components/freela-yide/FreelaHero";
import { calcularRival } from "@/lib/freela-yide/rivalidade";
import { MetaCard } from "@/components/freela-yide/MetaCard";
import { OportunidadesGrid } from "@/components/freela-yide/OportunidadesGrid";
import { MinhasOportunidades } from "@/components/freela-yide/MinhasOportunidades";
import { ResumoSubidos } from "@/components/freela-yide/ResumoSubidos";
import { RankingPainel } from "@/components/freela-yide/RankingPainel";
import { NovaOportunidadeButton } from "@/components/freela-yide/NovaOportunidadeButton";
import { DefinirMetaButton } from "@/components/freela-yide/DefinirMetaButton";
import { ROLES_ALLOWED, ROLES_GESTAO, ROLES_PODE_CRIAR } from "@/lib/freela-yide/acesso";

export default async function FreelaYidePage() {
  const user = await requireAuth();
  if (!ROLES_ALLOWED.includes(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const gestao = ROLES_GESTAO.includes(user.role);
  const podeCriar = ROLES_PODE_CRIAR.includes(user.role);
  const podePegar = user.role !== "adm"; // adm não pega freela

  const [todas, minhas, todasLancadas, ranking, historico, meta, stats] = await Promise.all([
    listOportunidades(orgId, true),
    listMinhas(orgId, user.id),
    podeCriar ? listOportunidades(orgId, false) : Promise.resolve([]),
    getRanking(orgId),
    getHistorico(orgId),
    getMetaAtual(orgId),
    getStats(orgId, user.id),
  ]);

  // XP do nível = pontos acumulados de todos os tempos (historico.geral). 0 se ainda não pontuou.
  const xpTotal = historico.geral.find((g) => g.user_id === user.id)?.pontos ?? 0;
  // Rivalidade: quem está logo acima no ranking do mês corrente.
  const rival = calcularRival(ranking, user.id);

  return (
    <div className="space-y-6">
      <FreelaHero stats={stats} xpTotal={xpTotal} rival={rival} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Oportunidades disponíveis</h2>
              {podeCriar && <NovaOportunidadeButton />}
            </div>
            <OportunidadesGrid ops={todas} gestao={gestao} podePegar={podePegar} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Minhas oportunidades</h2>
            <MinhasOportunidades ops={minhas} />
          </section>

          {podeCriar && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Todas lançadas</h2>
              <ResumoSubidos ops={todasLancadas} />
              <OportunidadesGrid ops={todasLancadas} gestao={gestao} podePegar={podePegar} />
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

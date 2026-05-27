import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
} from "@/lib/dashboard/queries";
import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";
import { KpiRowCoord } from "./KpiRowCoord";
import { RemuneracaoCard } from "./RemuneracaoCard";
import { ChartCarteiraTimelineLazy } from "./ChartCarteiraTimelineLazy";
import { ChartEntradaChurnLazy } from "./ChartEntradaChurnLazy";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { AlertaOnboardingAtrasadoSection } from "./AlertaOnboardingAtrasado";
import { Section } from "./Section";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { InstagramPostsSection } from "./sections";
import { Suspense } from "react";

function IgListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
      ))}
    </div>
  );
}

interface Props {
  userId: string;
  nome: string;
}

export async function DashboardCoord({ userId, nome }: Props) {
  const filter = { coordenadorId: userId };

  const [kpis, carteiraTimeline, entradaChurn, carteiraPorAssessor, ranking, eventos, comissao] =
    await Promise.all([
      getKpis(filter),
      getCarteiraTimeline(12, filter),
      getEntradaChurn(6, filter),
      getCarteiraPorAssessor(filter),
      getRankingSatisfacao(filter),
      getProximosEventos(30, 10, { userId }),
      getComissaoPrevista(userId, "coordenador"),
    ]);

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {nome.split(" ")[0]}</h1>
            <p className="text-sm text-muted-foreground">Visão da sua coordenação</p>
          </div>
          <HiddenValueToggle />
        </header>

        <Suspense fallback={null}>
          <AlertaOnboardingAtrasadoSection userId={userId} role="coordenador" />
        </Suspense>

        <KpiRowCoord kpis={kpis} />
        <RemuneracaoCard comissao={comissao} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
            <ChartCarteiraTimelineLazy data={carteiraTimeline} />
          </Section>
          <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
            <ChartEntradaChurnLazy data={entradaChurn} />
          </Section>
        </div>

        <Section title="Carteira por assessor (sob sua coordenação)">
          <CarteiraPorAssessorList items={carteiraPorAssessor} />
        </Section>

        <Suspense fallback={<IgListSkeleton />}>
          <InstagramPostsSection assessorId={null} titulo="Postagens no Instagram" />
        </Suspense>

        <Section title="Satisfação dos meus clientes" subtitle="Top 10 mais e menos satisfeitos da semana" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
          <RankingResumo top={ranking.top} bottom={ranking.bottom} />
        </Section>

        <Section title="Próximos eventos meus" cta={{ href: "/calendario", label: "Ver agenda →" }}>
          <ProximosEventosList eventos={eventos} />
        </Section>

        <PainelAudiovisualSection />
      </div>
    </HiddenValuesProvider>
  );
}

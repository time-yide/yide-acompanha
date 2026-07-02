import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getRankingSatisfacao,
  getProximosEventos,
} from "@/lib/dashboard/queries";
import { getComissaoDoMes } from "@/lib/dashboard/comissao-prevista";
import { KpiRowAssessor } from "./KpiRowAssessor";
import { RemuneracaoCard } from "./RemuneracaoCard";
import { ChartCarteiraTimelineLazy } from "./ChartCarteiraTimelineLazy";
import { ChartEntradaChurnLazy } from "./ChartEntradaChurnLazy";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { AlertaOnboardingAtrasadoSection } from "./AlertaOnboardingAtrasado";
import { Section } from "./Section";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { InstagramPostsSection } from "./sections";
import { MesSelector } from "./MesSelector";
import { EspecialidadeBadge } from "@/components/colaboradores/EspecialidadeBadge";
import { Suspense } from "react";

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
      ))}
    </div>
  );
}

interface Props {
  userId: string;
  nome: string;
  especialidade?: string | null;
  mes: string;
  mesAtual: string;
  meses: string[];
}

export async function DashboardAssessor({ userId, nome, especialidade, mes, mesAtual, meses }: Props) {
  const filter = { assessorId: userId };
  const isMesAtual = mes === mesAtual;

  const [kpis, carteiraTimeline, entradaChurn, ranking, eventos, comissao] = await Promise.all([
    getKpis(filter, mes),
    getCarteiraTimeline(12, filter, mes),
    getEntradaChurn(6, filter, mes),
    getRankingSatisfacao(filter),
    isMesAtual ? getProximosEventos(30, 10, { userId }) : Promise.resolve([]),
    getComissaoDoMes(userId, "assessor", mes, isMesAtual),
  ]);

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {nome.split(" ")[0]}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              Sua carteira
              <EspecialidadeBadge especialidade={especialidade} />
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <MesSelector mes={mes} meses={meses} mesAtual={mesAtual} />
            <HiddenValueToggle />
          </div>
        </header>

        <Suspense fallback={null}>
          <AlertaOnboardingAtrasadoSection userId={userId} role="assessor" />
        </Suspense>

        <KpiRowAssessor kpis={kpis} />
        <RemuneracaoCard comissao={comissao} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Evolução da minha carteira" subtitle="Últimos 12 meses">
            <ChartCarteiraTimelineLazy data={carteiraTimeline} />
          </Section>
          <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
            <ChartEntradaChurnLazy data={entradaChurn} />
          </Section>
        </div>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <InstagramPostsSection
            assessorId={userId}
            titulo="Suas postagens no Instagram"
          />
        </Suspense>

        {isMesAtual && (
          <Section title="Satisfação dos meus clientes" subtitle="Top 10 mais e menos satisfeitos da semana" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
            <RankingResumo top={ranking.top} bottom={ranking.bottom} />
          </Section>
        )}

        {isMesAtual && (
          <Section title="Próximos eventos meus" cta={{ href: "/calendario", label: "Ver agenda →" }}>
            <ProximosEventosList eventos={eventos} />
          </Section>
        )}

        <PainelAudiovisualSection />
      </div>
    </HiddenValuesProvider>
  );
}

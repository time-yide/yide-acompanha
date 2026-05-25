import { Suspense } from "react";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { AlertaOnboardingAtrasadoSection } from "./AlertaOnboardingAtrasado";
import {
  AlertaAprovacaoSection,
  KpiRowSection,
  CarteiraTimelineSection,
  EntradaChurnSection,
  CarteiraPorAssessorSection,
  RankingSection,
  ProximosEventosSection,
  RemuneracaoSection,
  RemuneracaoSkeleton,
  KpiRowSkeleton,
  ChartSkeleton,
  ListSkeleton,
  InstagramPostsSection,
} from "./sections";

interface Props {
  userId: string;
  nome: string;
}

/**
 * Shell síncrono. Cada seção streama via Suspense - saudação aparece
 * imediatamente, KPIs/charts/listas chegam quando suas queries resolvem.
 * Mobile vê algo em ~300ms ao invés de esperar 2s+ pelo Promise.all.
 */
export function DashboardSocioAdm({ userId, nome }: Props) {
  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Olá, {nome.split(" ")[0]}
            </h1>
            <p className="text-sm text-muted-foreground">Visão geral da agência</p>
          </div>
          <HiddenValueToggle />
        </header>

        <Suspense fallback={null}>
          <AlertaAprovacaoSection />
        </Suspense>

        <Suspense fallback={null}>
          <AlertaOnboardingAtrasadoSection userId={userId} role="socio" />
        </Suspense>

        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiRowSection />
        </Suspense>

        <Suspense fallback={<RemuneracaoSkeleton />}>
          <RemuneracaoSection userId={userId} />
        </Suspense>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<ChartSkeleton />}>
            <CarteiraTimelineSection />
          </Suspense>
          <Suspense fallback={<ChartSkeleton />}>
            <EntradaChurnSection />
          </Suspense>
        </div>

        <Suspense fallback={<ListSkeleton rows={6} />}>
          <CarteiraPorAssessorSection />
        </Suspense>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <InstagramPostsSection
            assessorId={null}
            titulo="Postagens no Instagram (Geral)"
          />
        </Suspense>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <RankingSection />
        </Suspense>

        <Suspense fallback={<ListSkeleton rows={5} />}>
          <ProximosEventosSection />
        </Suspense>

        <Suspense fallback={<ListSkeleton rows={4} />}>
          <PainelAudiovisualSection />
        </Suspense>
      </div>
    </HiddenValuesProvider>
  );
}

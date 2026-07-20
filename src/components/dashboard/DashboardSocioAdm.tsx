import { Suspense } from "react";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { AlertaOnboardingAtrasadoSection } from "./AlertaOnboardingAtrasado";
import { MesSelector } from "./MesSelector";
import {
  AlertaAprovacaoSection,
  KpiRowSection,
  CarteiraTimelineSection,
  EntradaChurnSection,
  MotivosChurnSection,
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
  mes: string;
  mesAtual: string;
  meses: string[];
}

/**
 * Shell síncrono. Cada seção streama via Suspense - saudação aparece
 * imediatamente, KPIs/charts/listas chegam quando suas queries resolvem.
 * Mobile vê algo em ~300ms ao invés de esperar 2s+ pelo Promise.all.
 *
 * `mes` (do MesSelector) re-escopa KPIs, gráficos e carteira por assessor a um
 * mês fechado. Seções "ao vivo" (alertas, remuneração em curso, satisfação da
 * semana, próximos eventos, Instagram, painel audiovisual) só fazem sentido no
 * mês corrente — quando `mes` é histórico, ficam ocultas pra não mostrar dado
 * do "agora" rotulado como se fosse daquele mês.
 */
export function DashboardSocioAdm({ userId, nome, mes, mesAtual, meses }: Props) {
  const isMesAtual = mes === mesAtual;

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
          <div className="flex flex-col items-end gap-2">
            <MesSelector mes={mes} meses={meses} mesAtual={mesAtual} />
            <HiddenValueToggle />
          </div>
        </header>

        {isMesAtual && (
          <Suspense fallback={null}>
            <AlertaAprovacaoSection />
          </Suspense>
        )}

        {isMesAtual && (
          <Suspense fallback={null}>
            <AlertaOnboardingAtrasadoSection userId={userId} role="socio" />
          </Suspense>
        )}

        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiRowSection mes={mes} />
        </Suspense>

        {isMesAtual && (
          <Suspense fallback={<RemuneracaoSkeleton />}>
            <RemuneracaoSection userId={userId} />
          </Suspense>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<ChartSkeleton />}>
            <CarteiraTimelineSection mes={mes} />
          </Suspense>
          <Suspense fallback={<ChartSkeleton />}>
            <EntradaChurnSection mes={mes} />
          </Suspense>
          <Suspense fallback={<ChartSkeleton />}>
            <MotivosChurnSection mes={mes} />
          </Suspense>
        </div>

        <Suspense fallback={<ListSkeleton rows={6} />}>
          <CarteiraPorAssessorSection mes={mes} />
        </Suspense>

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <InstagramPostsSection
              assessorId={null}
              titulo="Postagens no Instagram (Geral)"
              exigirSelecaoAssessor
            />
          </Suspense>
        )}

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <RankingSection />
          </Suspense>
        )}

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <ProximosEventosSection />
          </Suspense>
        )}

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={4} />}>
            <PainelAudiovisualSection />
          </Suspense>
        )}
      </div>
    </HiddenValuesProvider>
  );
}

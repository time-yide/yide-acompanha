import { Suspense } from "react";
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
import { InstagramPostsSection, KpiRowSkeleton, ChartSkeleton, ListSkeleton, RemuneracaoSkeleton } from "./sections";
import { MesSelector } from "./MesSelector";
import { EspecialidadeBadge } from "@/components/colaboradores/EspecialidadeBadge";

interface Props {
  userId: string;
  nome: string;
  especialidade?: string | null;
  mes: string;
  mesAtual: string;
  meses: string[];
}

// Seções async escopadas à carteira do assessor (`{ assessorId }`). Com o shell
// síncrono + Suspense abaixo, saudação e postagens do Instagram aparecem na hora;
// KPIs/gráficos/listas streamam quando cada query resolve. Antes um Promise.all
// de 6 queries bloqueava até a saudação até a query mais lenta (comissão/ranking).

async function KpiSection({ userId, mes }: { userId: string; mes: string }) {
  const kpis = await getKpis({ assessorId: userId }, mes);
  return <KpiRowAssessor kpis={kpis} />;
}

async function RemuneracaoAssessorSection({ userId, mes, isMesAtual }: { userId: string; mes: string; isMesAtual: boolean }) {
  const comissao = await getComissaoDoMes(userId, "assessor", mes, isMesAtual);
  return <RemuneracaoCard comissao={comissao} />;
}

async function CarteiraTimelineSection({ userId, mes }: { userId: string; mes: string }) {
  const data = await getCarteiraTimeline(12, { assessorId: userId }, mes);
  return (
    <Section title="Evolução da minha carteira" subtitle="Últimos 12 meses">
      <ChartCarteiraTimelineLazy data={data} />
    </Section>
  );
}

async function EntradaChurnSection({ userId, mes }: { userId: string; mes: string }) {
  const data = await getEntradaChurn(6, { assessorId: userId }, mes);
  return (
    <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
      <ChartEntradaChurnLazy data={data} />
    </Section>
  );
}

async function RankingAssessorSection({ userId }: { userId: string }) {
  const ranking = await getRankingSatisfacao({ assessorId: userId });
  return (
    <Section title="Satisfação dos meus clientes" subtitle="Top 10 mais e menos satisfeitos da semana" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
      <RankingResumo top={ranking.top} bottom={ranking.bottom} />
    </Section>
  );
}

async function ProximosEventosAssessorSection({ userId }: { userId: string }) {
  const eventos = await getProximosEventos(30, 10, { userId });
  return (
    <Section title="Próximos eventos meus" cta={{ href: "/calendario", label: "Ver agenda →" }}>
      <ProximosEventosList eventos={eventos} />
    </Section>
  );
}

/**
 * Shell síncrono. Saudação e postagens no topo aparecem imediatamente; o resto
 * streama via Suspense quando cada query resolve (padrão do DashboardSocioAdm).
 */
export function DashboardAssessor({ userId, nome, especialidade, mes, mesAtual, meses }: Props) {
  const isMesAtual = mes === mesAtual;

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

        {/* Postagem no topo: primeira coisa que o assessor vê (decisão Yasmin). */}
        <Suspense fallback={<ListSkeleton rows={5} />}>
          <InstagramPostsSection
            assessorId={userId}
            titulo="Suas postagens no Instagram"
          />
        </Suspense>

        <Suspense fallback={null}>
          <AlertaOnboardingAtrasadoSection userId={userId} role="assessor" />
        </Suspense>

        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiSection userId={userId} mes={mes} />
        </Suspense>

        <Suspense fallback={<RemuneracaoSkeleton />}>
          <RemuneracaoAssessorSection userId={userId} mes={mes} isMesAtual={isMesAtual} />
        </Suspense>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<ChartSkeleton />}>
            <CarteiraTimelineSection userId={userId} mes={mes} />
          </Suspense>
          <Suspense fallback={<ChartSkeleton />}>
            <EntradaChurnSection userId={userId} mes={mes} />
          </Suspense>
        </div>

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <RankingAssessorSection userId={userId} />
          </Suspense>
        )}

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <ProximosEventosAssessorSection userId={userId} />
          </Suspense>
        )}

        <Suspense fallback={<ListSkeleton rows={4} />}>
          <PainelAudiovisualSection />
        </Suspense>
      </div>
    </HiddenValuesProvider>
  );
}

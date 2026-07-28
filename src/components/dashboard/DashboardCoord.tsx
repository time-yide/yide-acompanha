import { Suspense } from "react";
import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
} from "@/lib/dashboard/queries";
import { getComissaoDoMes } from "@/lib/dashboard/comissao-prevista";
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
import { MesSelector } from "./MesSelector";
import { KpiRowSkeleton, ChartSkeleton, ListSkeleton, RemuneracaoSkeleton } from "./sections";

interface Props {
  userId: string;
  nome: string;
  mes: string;
  mesAtual: string;
  meses: string[];
}

// Cada seção async puxa só sua própria query, escopada à coordenação
// (`{ coordenadorId }`). Combinadas com <Suspense> no shell síncrono abaixo, a
// saudação aparece na hora e cada parte streama quando sua query resolve — antes
// um único Promise.all bloqueava tudo até a query mais lenta (comissão/ranking).

async function KpiSection({ userId, mes }: { userId: string; mes: string }) {
  const kpis = await getKpis({ coordenadorId: userId }, mes);
  return <KpiRowCoord kpis={kpis} />;
}

async function RemuneracaoCoordSection({ userId, mes, isMesAtual }: { userId: string; mes: string; isMesAtual: boolean }) {
  const comissao = await getComissaoDoMes(userId, "coordenador", mes, isMesAtual);
  return <RemuneracaoCard comissao={comissao} />;
}

async function CarteiraTimelineSection({ userId, mes }: { userId: string; mes: string }) {
  const data = await getCarteiraTimeline(12, { coordenadorId: userId }, mes);
  return (
    <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
      <ChartCarteiraTimelineLazy data={data} />
    </Section>
  );
}

async function EntradaChurnSection({ userId, mes }: { userId: string; mes: string }) {
  const data = await getEntradaChurn(6, { coordenadorId: userId }, mes);
  return (
    <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
      <ChartEntradaChurnLazy data={data} />
    </Section>
  );
}

async function CarteiraPorAssessorSection({ userId, mes }: { userId: string; mes: string }) {
  const items = await getCarteiraPorAssessor({ coordenadorId: userId }, mes);
  return (
    <Section title="Carteira por assessor (sob sua coordenação)">
      <CarteiraPorAssessorList items={items} />
    </Section>
  );
}

async function RankingCoordSection({ userId }: { userId: string }) {
  const ranking = await getRankingSatisfacao({ coordenadorId: userId });
  return (
    <Section title="Satisfação dos meus clientes" subtitle="Top 10 mais e menos satisfeitos da semana" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
      <RankingResumo top={ranking.top} bottom={ranking.bottom} />
    </Section>
  );
}

async function ProximosEventosCoordSection({ userId }: { userId: string }) {
  const eventos = await getProximosEventos(30, 10, { userId });
  return (
    <Section title="Próximos eventos meus" cta={{ href: "/calendario", label: "Ver agenda →" }}>
      <ProximosEventosList eventos={eventos} />
    </Section>
  );
}

/**
 * Shell síncrono. Saudação renderiza imediatamente; KPIs/gráficos/listas
 * streamam via Suspense quando cada query resolve (padrão do DashboardSocioAdm).
 */
export function DashboardCoord({ userId, nome, mes, mesAtual, meses }: Props) {
  const isMesAtual = mes === mesAtual;

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {nome.split(" ")[0]}</h1>
            <p className="text-sm text-muted-foreground">Visão da sua coordenação</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <MesSelector mes={mes} meses={meses} mesAtual={mesAtual} />
            <HiddenValueToggle />
          </div>
        </header>

        {isMesAtual && (
          <Suspense fallback={null}>
            <AlertaOnboardingAtrasadoSection userId={userId} role="coordenador" />
          </Suspense>
        )}

        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiSection userId={userId} mes={mes} />
        </Suspense>

        <Suspense fallback={<RemuneracaoSkeleton />}>
          <RemuneracaoCoordSection userId={userId} mes={mes} isMesAtual={isMesAtual} />
        </Suspense>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<ChartSkeleton />}>
            <CarteiraTimelineSection userId={userId} mes={mes} />
          </Suspense>
          <Suspense fallback={<ChartSkeleton />}>
            <EntradaChurnSection userId={userId} mes={mes} />
          </Suspense>
        </div>

        <Suspense fallback={<ListSkeleton rows={6} />}>
          <CarteiraPorAssessorSection userId={userId} mes={mes} />
        </Suspense>

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <RankingCoordSection userId={userId} />
          </Suspense>
        )}

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <ProximosEventosCoordSection userId={userId} />
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

import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "./KpiRow";
import { ChartCarteiraTimeline } from "./ChartCarteiraTimeline";
import { ChartEntradaChurn } from "./ChartEntradaChurn";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { AlertaAprovacao } from "./AlertaAprovacao";
import { Section } from "./Section";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";

interface Props {
  nome: string;
}

export async function DashboardSocioAdm({ nome }: Props) {
  const [
    kpis,
    carteiraTimeline,
    entradaChurn,
    carteiraPorAssessor,
    ranking,
    eventos,
    aprovacao,
  ] = await Promise.all([
    getKpis(),
    getCarteiraTimeline(12),
    getEntradaChurn(6),
    getCarteiraPorAssessor(),
    getRankingSatisfacao(),
    getProximosEventos(30, 10),
    getMesAguardandoAprovacao(),
  ]);

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {nome.split(" ")[0]}</h1>
            <p className="text-sm text-muted-foreground">Visão geral da agência</p>
          </div>
          <HiddenValueToggle />
        </header>

        <AlertaAprovacao mes={aprovacao?.mes ?? null} />

        <KpiRow kpis={kpis} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
            <ChartCarteiraTimeline data={carteiraTimeline} />
          </Section>
          <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
            <ChartEntradaChurn data={entradaChurn} />
          </Section>
        </div>

        <Section title="Carteira por assessor">
          <CarteiraPorAssessorList items={carteiraPorAssessor} />
        </Section>

        <Section title="Satisfação" subtitle="Top 10 mais e menos satisfeitos da semana" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
          <RankingResumo top={ranking.top} bottom={ranking.bottom} />
        </Section>

        <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
          <ProximosEventosList eventos={eventos} />
        </Section>
      </div>
    </HiddenValuesProvider>
  );
}

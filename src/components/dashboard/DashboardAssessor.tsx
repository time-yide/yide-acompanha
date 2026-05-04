import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getRankingSatisfacao,
  getProximosEventos,
} from "@/lib/dashboard/queries";
import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";
import { KpiRowAssessor } from "./KpiRowAssessor";
import { RemuneracaoCard } from "./RemuneracaoCard";
import { ChartCarteiraTimeline } from "./ChartCarteiraTimeline";
import { ChartEntradaChurn } from "./ChartEntradaChurn";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { Section } from "./Section";

interface Props {
  userId: string;
  nome: string;
}

export async function DashboardAssessor({ userId, nome }: Props) {
  const filter = { assessorId: userId };

  const [kpis, carteiraTimeline, entradaChurn, ranking, eventos, comissao] = await Promise.all([
    getKpis(undefined, filter),
    getCarteiraTimeline(12, undefined, filter),
    getEntradaChurn(6, undefined, filter),
    getRankingSatisfacao(filter),
    getProximosEventos(30, 10, { userId }),
    getComissaoPrevista(userId, "assessor"),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Sua carteira</p>
      </header>

      <KpiRowAssessor kpis={kpis} />
      <RemuneracaoCard comissao={comissao} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Evolução da minha carteira" subtitle="Últimos 12 meses">
          <ChartCarteiraTimeline data={carteiraTimeline} />
        </Section>
        <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
          <ChartEntradaChurn data={entradaChurn} />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Satisfação dos meus clientes" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
          <RankingResumo top={ranking.top} bottom={ranking.bottom} />
        </Section>
        <Section title="Próximos eventos meus" cta={{ href: "/calendario", label: "Ver agenda →" }}>
          <ProximosEventosList eventos={eventos} />
        </Section>
      </div>
    </div>
  );
}

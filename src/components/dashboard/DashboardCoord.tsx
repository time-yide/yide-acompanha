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
import { ChartCarteiraTimeline } from "./ChartCarteiraTimeline";
import { ChartEntradaChurn } from "./ChartEntradaChurn";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { Section } from "./Section";

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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão da sua coordenação</p>
      </header>

      <KpiRowCoord kpis={kpis} />
      <RemuneracaoCard comissao={comissao} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
          <ChartCarteiraTimeline data={carteiraTimeline} />
        </Section>
        <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
          <ChartEntradaChurn data={entradaChurn} />
        </Section>
      </div>

      <Section title="Carteira por assessor (sob sua coordenação)">
        <CarteiraPorAssessorList items={carteiraPorAssessor} />
      </Section>

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

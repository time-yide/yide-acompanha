import {
  getKpis,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "./KpiRow";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { AlertaAprovacao } from "./AlertaAprovacao";
import { Section } from "./Section";

interface Props {
  nome: string;
}

// Dashboard sócio/adm SEM os charts (Recharts) que estavam suspeitos do crash.
// Se essa versão estabilizar, os charts são o culpado isolado e precisam de
// fix dedicado (provável incompatibilidade com React 19 / Next 16 ou versão
// do recharts).
export async function DashboardSocioAdm({ nome }: Props) {
  const [
    kpis,
    carteiraPorAssessor,
    ranking,
    eventos,
    aprovacao,
  ] = await Promise.all([
    getKpis(),
    getCarteiraPorAssessor(),
    getRankingSatisfacao(),
    getProximosEventos(30, 10),
    getMesAguardandoAprovacao(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão geral da agência</p>
      </header>

      <AlertaAprovacao mes={aprovacao?.mes ?? null} />

      <KpiRow kpis={kpis} />

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
  );
}

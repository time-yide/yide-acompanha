import { requireAuth } from "@/lib/auth/session";
import {
  getKpis,
  getCarteiraTimeline,
  getEntradaChurn,
  getCarteiraPorAssessor,
  getRankingSatisfacao,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { ChartCarteiraTimeline } from "@/components/dashboard/ChartCarteiraTimeline";
import { ChartEntradaChurn } from "@/components/dashboard/ChartEntradaChurn";
import { CarteiraPorAssessorList } from "@/components/dashboard/CarteiraPorAssessorList";
import { RankingResumo } from "@/components/dashboard/RankingResumo";
import { ProximosEventosList } from "@/components/dashboard/ProximosEventosList";
import { AlertaAprovacao } from "@/components/dashboard/AlertaAprovacao";
import { Section } from "@/components/dashboard/Section";
import { StubGreeting } from "@/components/dashboard/StubGreeting";

export default async function DashboardPage() {
  const user = await requireAuth();

  if (user.role !== "socio" && user.role !== "adm") {
    return <StubGreeting nome={user.nome} />;
  }

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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {user.nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão geral da agência</p>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Satisfação" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
          <RankingResumo top={ranking.top} bottom={ranking.bottom} />
        </Section>
        <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
          <ProximosEventosList eventos={eventos} />
        </Section>
      </div>
    </div>
  );
}

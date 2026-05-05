import {
  getKpis,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "./KpiRow";
import { AlertaAprovacao } from "./AlertaAprovacao";
import { ProximosEventosList } from "./ProximosEventosList";
import { Section } from "./Section";

interface Props {
  nome: string;
}

// Bisseção: KPI + Alerta + ProximosEventos. Sem Carteira por Assessor e sem Ranking.
export async function DashboardSocioAdm({ nome }: Props) {
  const [kpis, eventos, aprovacao] = await Promise.all([
    getKpis(),
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

      <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
        <ProximosEventosList eventos={eventos} />
      </Section>

      <p className="text-center text-xs text-muted-foreground">
        Carteira por assessor e ranking de satisfação ainda removidos enquanto isolamos o bug.
      </p>
    </div>
  );
}

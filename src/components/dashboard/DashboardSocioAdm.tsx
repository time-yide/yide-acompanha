import {
  getKpis,
  getCarteiraPorAssessor,
  getProximosEventos,
  getMesAguardandoAprovacao,
} from "@/lib/dashboard/queries";
import { KpiRow } from "./KpiRow";
import { CarteiraPorAssessorList } from "./CarteiraPorAssessorList";
import { ProximosEventosList } from "./ProximosEventosList";
import { AlertaAprovacao } from "./AlertaAprovacao";
import { Section } from "./Section";

interface Props {
  nome: string;
}

// Charts (Recharts) e Satisfação (RankingResumo) removidos temporariamente
// pra estabilizar produção. Investigação do crash da home em curso —
// retornam após causa raiz identificada.
export async function DashboardSocioAdm({ nome }: Props) {
  const [
    kpis,
    carteiraPorAssessor,
    eventos,
    aprovacao,
  ] = await Promise.all([
    getKpis(),
    getCarteiraPorAssessor(),
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

      <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
        <ProximosEventosList eventos={eventos} />
      </Section>

      <p className="text-center text-xs text-muted-foreground">
        Gráficos e ranking de satisfação temporariamente removidos enquanto
        investigamos um problema técnico. Você pode acessar o ranking completo
        em <a href="/satisfacao" className="text-primary hover:underline">/satisfacao</a>.
      </p>
    </div>
  );
}

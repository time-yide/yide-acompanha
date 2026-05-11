import { getKpis, getRankingSatisfacao, getProximosEventos } from "@/lib/dashboard/queries";
import { listLeadsByStage } from "@/lib/leads/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  listClientPaymentsForMonth,
  listPayrollForMonth,
  getCurrentMonthRef,
} from "@/lib/pagamentos/queries";
import { KpiRowAdm } from "./adm/KpiRowAdm";
import { LeadsContratoCard } from "./adm/LeadsContratoCard";
import { ClientPaymentsTable } from "./adm/ClientPaymentsTable";
import { PayrollPaymentsTable } from "./adm/PayrollPaymentsTable";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { Section } from "./Section";

interface Props {
  nome: string;
}

async function getEmAcompanhamentoCount(): Promise<number> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("status", "em_onboarding");
  return count ?? 0;
}

export async function DashboardAdm({ nome }: Props) {
  const mes = getCurrentMonthRef();

  const [kpis, leadsByStage, emAcompanhamento, ranking, eventos, clientPayments, payroll] = await Promise.all([
    getKpis(),
    listLeadsByStage(),
    getEmAcompanhamentoCount(),
    getRankingSatisfacao(),
    // ADM só vê eventos administrativos: agencia (reuniões internas),
    // onboarding (reuniões comerciais que ela acompanha) e aniversarios.
    // Gravações de videomaker e eventos de assessor/coord ficam de fora.
    getProximosEventos(30, 8, { subCalendars: ["agencia", "onboarding", "aniversarios"] }),
    listClientPaymentsForMonth(mes),
    listPayrollForMonth(mes),
  ]);

  const leadsContrato = leadsByStage.contrato ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão administrativa</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LeadsContratoCard leads={leadsContrato} />
        <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
          <ProximosEventosList eventos={eventos} />
        </Section>
      </div>

      <KpiRowAdm
        clientesAtivos={kpis.clientesAtivos.quantidade}
        deltaClientesAtivos={kpis.clientesAtivos.deltaQuantidade}
        churnMes={kpis.churnMes.quantidade}
        emAcompanhamento={emAcompanhamento}
        pontuaisAtivos={kpis.servicosPontuais.ativos}
        pontuaisConcluidosMes={kpis.servicosPontuais.concluidosMes}
      />

      <Section
        title="Satisfação"
        subtitle="Top 10 mais e menos satisfeitos da semana"
        cta={{ href: "/satisfacao", label: "Ver completo →" }}
      >
        <RankingResumo top={ranking.top} bottom={ranking.bottom} />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClientPaymentsTable rows={clientPayments} mesReferencia={mes} />
        <PayrollPaymentsTable rows={payroll} mesReferencia={mes} />
      </div>

      <PainelAudiovisualSection />
    </div>
  );
}

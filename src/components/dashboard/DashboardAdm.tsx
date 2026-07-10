import { getKpis, getRankingSatisfacao, getProximosEventos } from "@/lib/dashboard/queries";
import { listLeadsByStage } from "@/lib/leads/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  listClientPaymentsForMonth,
  listPayrollForMonth,
} from "@/lib/pagamentos/queries";
import { KpiRowAdm } from "./adm/KpiRowAdm";
import { LeadsContratoCard } from "./adm/LeadsContratoCard";
import { ClientPaymentsTable } from "./adm/ClientPaymentsTable";
import { PayrollPaymentsTable } from "./adm/PayrollPaymentsTable";
import { RankingResumo } from "./RankingResumo";
import { ProximosEventosList } from "./ProximosEventosList";
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { AlertaOnboardingAtrasadoSection } from "./AlertaOnboardingAtrasado";
import { MesSelector } from "./MesSelector";
import { Section } from "./Section";
import { Suspense } from "react";

interface Props {
  userId: string;
  nome: string;
  mes: string;
  mesAtual: string;
  meses: string[];
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

/**
 * `mes` (do MesSelector) re-escopa KPIs e as tabelas de pagamento (cliente +
 * folha) a um mês fechado. Seções "ao vivo" — leads em contrato, satisfação da
 * semana, próximos eventos, Instagram, painel audiovisual e o alerta de
 * onboarding — só aparecem no mês corrente.
 */
export async function DashboardAdm({ userId, nome, mes, mesAtual, meses }: Props) {
  const isMesAtual = mes === mesAtual;

  const [kpis, emAcompanhamento, clientPayments, payroll, leadsByStage, ranking, eventos] =
    await Promise.all([
      getKpis(undefined, mes),
      getEmAcompanhamentoCount(),
      listClientPaymentsForMonth(mes),
      listPayrollForMonth(mes),
      isMesAtual ? listLeadsByStage() : Promise.resolve(null),
      isMesAtual ? getRankingSatisfacao() : Promise.resolve({ top: [], bottom: [] }),
      // ADM só vê eventos administrativos: agencia (reuniões internas),
      // onboarding (reuniões comerciais que ela acompanha) e aniversarios.
      // Gravações de videomaker e eventos de assessor/coord ficam de fora.
      isMesAtual
        ? getProximosEventos(30, 8, { subCalendars: ["agencia", "onboarding", "aniversarios"] })
        : Promise.resolve([]),
    ]);

  const leadsContrato = leadsByStage?.contrato ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {nome.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Visão administrativa</p>
        </div>
        <MesSelector mes={mes} meses={meses} mesAtual={mesAtual} />
      </header>

      {isMesAtual && (
        <Suspense fallback={null}>
          <AlertaOnboardingAtrasadoSection userId={userId} role="adm" />
        </Suspense>
      )}

      {isMesAtual && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LeadsContratoCard leads={leadsContrato} />
          <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
            <ProximosEventosList eventos={eventos} />
          </Section>
        </div>
      )}

      <KpiRowAdm
        clientesAtivos={kpis.clientesAtivos.quantidade}
        deltaClientesAtivos={kpis.clientesAtivos.deltaQuantidade}
        churnMes={kpis.churnMes.quantidade}
        emAcompanhamento={emAcompanhamento}
        pontuaisAtivos={kpis.servicosPontuais.ativos}
        pontuaisConcluidosMes={kpis.servicosPontuais.concluidosMes}
      />

      {isMesAtual && (
        <Section
          title="Satisfação"
          subtitle="Top 10 mais e menos satisfeitos da semana"
          cta={{ href: "/satisfacao", label: "Ver completo →" }}
        >
          <RankingResumo top={ranking.top} bottom={ranking.bottom} />
        </Section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClientPaymentsTable rows={clientPayments} mesReferencia={mes} />
        <PayrollPaymentsTable rows={payroll} mesReferencia={mes} />
      </div>

      {isMesAtual && <PainelAudiovisualSection />}
    </div>
  );
}

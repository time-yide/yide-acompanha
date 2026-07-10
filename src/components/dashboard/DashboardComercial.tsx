import {
  getLeadsKpis,
  getFunnelData,
  getProximasReunioes,
  getMetaComercial,
} from "@/lib/dashboard/comercial-queries";
import { getComissaoDoMes } from "@/lib/dashboard/comissao-prevista";
import { lastDayOfMonth } from "@/lib/dashboard/date-utils";
import { KpiRowComercial } from "./KpiRowComercial";
import { RemuneracaoCard } from "./RemuneracaoCard";
import { ChartFunilLazy } from "./ChartFunilLazy";
import { MetaTracker } from "./MetaTracker";
import { ProximasReunioesList } from "./ProximasReunioesList";
import { Section } from "./Section";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { MesSelector } from "./MesSelector";

interface Props {
  userId: string;
  nome: string;
  mes: string;
  mesAtual: string;
  meses: string[];
}

export async function DashboardComercial({ userId, nome, mes, mesAtual, meses }: Props) {
  const isMesAtual = mes === mesAtual;
  const dataNoMes = isMesAtual ? new Date() : new Date(`${lastDayOfMonth(mes)}T12:00:00Z`);

  const [leadsKpis, funnel, reunioes, meta, comissao] = await Promise.all([
    getLeadsKpis(userId, dataNoMes),
    isMesAtual ? getFunnelData(userId) : Promise.resolve([]),
    isMesAtual ? getProximasReunioes(userId, 14) : Promise.resolve([]),
    getMetaComercial(userId, dataNoMes),
    getComissaoDoMes(userId, "comercial", mes, isMesAtual),
  ]);

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {nome.split(" ")[0]}</h1>
            <p className="text-sm text-muted-foreground">Sua prospecção</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <MesSelector mes={mes} meses={meses} mesAtual={mesAtual} />
            <HiddenValueToggle />
          </div>
        </header>

        <KpiRowComercial leadsKpis={leadsKpis} />
        <RemuneracaoCard comissao={comissao} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isMesAtual && (
            <Section title="Funil de conversão" subtitle="5 estágios atuais">
              <ChartFunilLazy data={funnel} />
            </Section>
          )}
          <MetaTracker meta={meta} />
        </div>

        {isMesAtual && (
          <Section title="Próximas reuniões" subtitle="Próximos 14 dias" cta={{ href: "/onboarding", label: "Ver kanban →" }}>
            <ProximasReunioesList reunioes={reunioes} />
          </Section>
        )}

      </div>
    </HiddenValuesProvider>
  );
}

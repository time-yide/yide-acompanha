import { Suspense } from "react";
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
import { KpiRowSkeleton, ChartSkeleton, ListSkeleton, RemuneracaoSkeleton } from "./sections";

interface Props {
  userId: string;
  nome: string;
  mes: string;
  mesAtual: string;
  meses: string[];
}

// Cada seção puxa só a sua query e streama via <Suspense> no shell síncrono.
// Antes um único Promise.all bloqueava o primeiro byte até a query mais lenta
// (comissão) resolver — agora a saudação sai na hora e cada parte aparece
// quando fica pronta. As seções são renderizadas juntas, então as queries
// continuam disparando em paralelo.

async function KpiComercialSection({ userId, dataNoMes }: { userId: string; dataNoMes: Date }) {
  const leadsKpis = await getLeadsKpis(userId, dataNoMes);
  return <KpiRowComercial leadsKpis={leadsKpis} />;
}

async function RemuneracaoComercialSection({ userId, mes, isMesAtual }: { userId: string; mes: string; isMesAtual: boolean }) {
  const comissao = await getComissaoDoMes(userId, "comercial", mes, isMesAtual);
  return <RemuneracaoCard comissao={comissao} />;
}

async function FunilSection({ userId }: { userId: string }) {
  const funnel = await getFunnelData(userId);
  return (
    <Section title="Funil de conversão" subtitle="5 estágios atuais">
      <ChartFunilLazy data={funnel} />
    </Section>
  );
}

async function MetaSection({ userId, dataNoMes }: { userId: string; dataNoMes: Date }) {
  const meta = await getMetaComercial(userId, dataNoMes);
  return <MetaTracker meta={meta} />;
}

async function ReunioesComercialSection({ userId }: { userId: string }) {
  const reunioes = await getProximasReunioes(userId, 14);
  return (
    <Section title="Próximas reuniões" subtitle="Próximos 14 dias" cta={{ href: "/onboarding", label: "Ver kanban →" }}>
      <ProximasReunioesList reunioes={reunioes} />
    </Section>
  );
}

export function DashboardComercial({ userId, nome, mes, mesAtual, meses }: Props) {
  const isMesAtual = mes === mesAtual;
  const dataNoMes = isMesAtual ? new Date() : new Date(`${lastDayOfMonth(mes)}T12:00:00Z`);

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

        <Suspense fallback={<KpiRowSkeleton />}>
          <KpiComercialSection userId={userId} dataNoMes={dataNoMes} />
        </Suspense>

        <Suspense fallback={<RemuneracaoSkeleton />}>
          <RemuneracaoComercialSection userId={userId} mes={mes} isMesAtual={isMesAtual} />
        </Suspense>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isMesAtual && (
            <Suspense fallback={<ChartSkeleton />}>
              <FunilSection userId={userId} />
            </Suspense>
          )}
          <Suspense fallback={<ChartSkeleton />}>
            <MetaSection userId={userId} dataNoMes={dataNoMes} />
          </Suspense>
        </div>

        {isMesAtual && (
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <ReunioesComercialSection userId={userId} />
          </Suspense>
        )}
      </div>
    </HiddenValuesProvider>
  );
}

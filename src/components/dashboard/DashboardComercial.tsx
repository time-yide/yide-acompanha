import {
  getLeadsKpis,
  getFunnelData,
  getProximasReunioes,
  getMetaComercial,
} from "@/lib/dashboard/comercial-queries";
import { getComissaoPrevista } from "@/lib/dashboard/comissao-prevista";
import { KpiRowComercial } from "./KpiRowComercial";
import { RemuneracaoCard } from "./RemuneracaoCard";
import { ChartFunil } from "./ChartFunil";
import { MetaTracker } from "./MetaTracker";
import { ProximasReunioesList } from "./ProximasReunioesList";
import { Section } from "./Section";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";

interface Props {
  userId: string;
  nome: string;
}

export async function DashboardComercial({ userId, nome }: Props) {
  const [leadsKpis, funnel, reunioes, meta, comissao] = await Promise.all([
    getLeadsKpis(userId),
    getFunnelData(userId),
    getProximasReunioes(userId, 14),
    getMetaComercial(userId),
    getComissaoPrevista(userId, "comercial"),
  ]);

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {nome.split(" ")[0]}</h1>
            <p className="text-sm text-muted-foreground">Sua prospecção</p>
          </div>
          <HiddenValueToggle />
        </header>

        <KpiRowComercial leadsKpis={leadsKpis} />
        <RemuneracaoCard comissao={comissao} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Funil de conversão" subtitle="5 estágios atuais">
            <ChartFunil data={funnel} />
          </Section>
          <MetaTracker meta={meta} />
        </div>

        <Section title="Próximas reuniões" subtitle="Próximos 14 dias" cta={{ href: "/onboarding", label: "Ver kanban →" }}>
          <ProximasReunioesList reunioes={reunioes} />
        </Section>
      </div>
    </HiddenValuesProvider>
  );
}

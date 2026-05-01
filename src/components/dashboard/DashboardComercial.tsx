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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Sua prospecção</p>
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
  );
}

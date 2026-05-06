import { Users, CheckCircle2, TrendingUp, Target } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { Money } from "./HiddenValuesContext";
import type { LeadsKpis } from "@/lib/dashboard/comercial-queries";

interface Props {
  leadsKpis: LeadsKpis;
}

export function KpiRowComercial({ leadsKpis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Leads ativos"
        valor={String(leadsKpis.leadsAtivos)}
        helperText="em prospecção/comercial/contrato"
        icon={Users}
      />
      <KpiCard
        label="Fechamentos do mês"
        valor={String(leadsKpis.fechamentosMes)}
        helperText="leads convertidos em ativo"
        icon={CheckCircle2}
      />
      <KpiCard
        label="Ticket médio"
        valor={<Money value={leadsKpis.ticketMedio} noDecimals />}
        helperText="últimos 90 dias"
        icon={TrendingUp}
      />
      <KpiCard
        label="Taxa de conversão"
        valor={`${leadsKpis.taxaConversao.toFixed(1)}%`}
        helperText="últimos 90 dias"
        icon={Target}
      />
    </div>
  );
}

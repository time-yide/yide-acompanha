import { Users, CheckCircle2, TrendingUp, Target } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { LeadsKpis } from "@/lib/dashboard/comercial-queries";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

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
        valor={formatBRL(leadsKpis.ticketMedio)}
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

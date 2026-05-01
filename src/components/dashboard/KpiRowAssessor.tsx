import { Wallet, Users, TrendingDown } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { KpiData } from "@/lib/dashboard/queries";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatDelta(v: number, currency: boolean): { valor: string; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: currency ? "R$ 0" : "0", direction: "neutral" };
  const formatted = currency ? formatBRL(Math.abs(v)) : String(Math.abs(v));
  return { valor: formatted, direction: v > 0 ? "up" : "down" };
}

interface Props {
  kpis: KpiData;
}

export function KpiRowAssessor({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        label="Minha carteira"
        valor={formatBRL(kpis.carteiraAtiva.valor)}
        delta={formatDelta(kpis.carteiraAtiva.deltaValor, true)}
        helperText="vs mês anterior"
        icon={Wallet}
      />
      <KpiCard
        label="Meus clientes"
        valor={String(kpis.clientesAtivos.quantidade)}
        delta={formatDelta(kpis.clientesAtivos.deltaQuantidade, false)}
        helperText="vs mês anterior"
        icon={Users}
      />
      <KpiCard
        label="Meu churn"
        valor={String(kpis.churnMes.quantidade)}
        helperText={`${formatBRL(kpis.churnMes.valorPerdido)} perdidos`}
        icon={TrendingDown}
      />
    </div>
  );
}

import { Wallet, Users, TrendingDown, Percent, Coins } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { KpiData } from "@/lib/dashboard/queries";
import type { ComissaoPrevista } from "@/lib/dashboard/comissao-prevista";

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
  comissao: ComissaoPrevista;
}

export function KpiRowCoord({ kpis, comissao }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        label="Carteira sob coord."
        valor={formatBRL(kpis.carteiraAtiva.valor)}
        delta={formatDelta(kpis.carteiraAtiva.deltaValor, true)}
        helperText="vs mês anterior"
        icon={Wallet}
      />
      <KpiCard
        label="Clientes ativos"
        valor={String(kpis.clientesAtivos.quantidade)}
        delta={formatDelta(kpis.clientesAtivos.deltaQuantidade, false)}
        helperText="vs mês anterior"
        icon={Users}
      />
      <KpiCard
        label="Churn do mês"
        valor={String(kpis.churnMes.quantidade)}
        helperText={`${formatBRL(kpis.churnMes.valorPerdido)} perdidos`}
        icon={TrendingDown}
      />
      <KpiCard
        label="Custo de comissão"
        valor={`${kpis.custoComissaoPct.pct.toFixed(1)}%`}
        helperText="da carteira"
        icon={Percent}
      />
      <KpiCard
        label="Minha comissão prevista"
        valor={formatBRL(comissao.valor)}
        helperText={`${comissao.percentual}% sobre ${formatBRL(comissao.baseCalculo)} + fixo ${formatBRL(comissao.fixo)}`}
        icon={Coins}
      />
    </div>
  );
}

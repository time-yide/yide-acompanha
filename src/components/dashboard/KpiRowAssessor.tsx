import { Wallet, Users, TrendingDown } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { Money } from "./HiddenValuesContext";
import type { KpiData } from "@/lib/dashboard/queries";

function formatDeltaMoney(v: number): { valor: React.ReactNode; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: <Money value={0} noDecimals />, direction: "neutral" };
  return { valor: <Money value={Math.abs(v)} noDecimals />, direction: v > 0 ? "up" : "down" };
}

function formatDeltaCount(v: number): { valor: string; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: "0", direction: "neutral" };
  return { valor: String(Math.abs(v)), direction: v > 0 ? "up" : "down" };
}

interface Props {
  kpis: KpiData;
}

export function KpiRowAssessor({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        label="Minha carteira"
        valor={<Money value={kpis.carteiraAtiva.valor} noDecimals />}
        delta={formatDeltaMoney(kpis.carteiraAtiva.deltaValor)}
        helperText="vs mês anterior"
        icon={Wallet}
      />
      <KpiCard
        label="Meus clientes"
        valor={String(kpis.clientesAtivos.quantidade)}
        delta={formatDeltaCount(kpis.clientesAtivos.deltaQuantidade)}
        helperText="vs mês anterior"
        icon={Users}
      />
      <KpiCard
        label="Meu churn"
        valor={String(kpis.churnMes.quantidade)}
        helperText={<><Money value={kpis.churnMes.valorPerdido} noDecimals /> perdidos</>}
        icon={TrendingDown}
      />
    </div>
  );
}

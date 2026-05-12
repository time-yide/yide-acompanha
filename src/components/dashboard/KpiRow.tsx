import { Wallet, Users, TrendingDown, Percent, Sparkles, DollarSign } from "lucide-react";
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

/** Mês atual no formato YYYY-MM (BRT). */
function mesAtualBRT(): string {
  const d = new Date();
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function KpiRow({ kpis }: { kpis: KpiData }) {
  const pontuais = kpis.servicosPontuais;
  const mesAtual = mesAtualBRT();

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-6">
      <KpiCard
        label="Carteira ativa"
        valor={<Money value={kpis.carteiraAtiva.valor} noDecimals />}
        delta={formatDeltaMoney(kpis.carteiraAtiva.deltaValor)}
        helperText="vs mês anterior"
        icon={Wallet}
        href="/clientes?status=ativo"
      />
      <KpiCard
        label="Clientes ativos"
        valor={String(kpis.clientesAtivos.quantidade)}
        delta={formatDeltaCount(kpis.clientesAtivos.deltaQuantidade)}
        helperText="vs mês anterior"
        icon={Users}
        href="/clientes?status=ativo"
      />
      <KpiCard
        label="Churn do mês"
        valor={String(kpis.churnMes.quantidade)}
        helperText={<><Money value={kpis.churnMes.valorPerdido} noDecimals /> perdidos</>}
        icon={TrendingDown}
        href={`/clientes?status=churn&churn_mes=${mesAtual}`}
      />
      <KpiCard
        label="Serviços pontuais"
        valor={String(pontuais.ativos)}
        helperText={`${pontuais.concluidosMes} concluídos no mês`}
        icon={Sparkles}
        href="/clientes?status=ativo&modalidade=pontual"
      />
      <KpiCard
        label="Valor pontuais"
        valor={<Money value={pontuais.valorTotal} noDecimals />}
        helperText="soma dos ativos"
        icon={DollarSign}
        href="/clientes?status=ativo&modalidade=pontual"
      />
      <KpiCard
        label="Custo de comissão"
        valor={`${kpis.custoComissaoPct.pct.toFixed(1)}%`}
        helperText="da carteira"
        icon={Percent}
      />
    </div>
  );
}

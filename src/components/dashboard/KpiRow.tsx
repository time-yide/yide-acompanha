import { Wallet, Users, TrendingDown, Percent, Sparkles, DollarSign, Receipt, Infinity as InfinityIcon } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { Money } from "./HiddenValuesContext";
import type { KpiData } from "@/lib/dashboard/queries";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";

function formatDeltaMoney(v: number): { valor: React.ReactNode; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: <Money value={0} noDecimals />, direction: "neutral" };
  return { valor: <Money value={Math.abs(v)} noDecimals />, direction: v > 0 ? "up" : "down" };
}

function formatDeltaCount(v: number): { valor: string; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: "0", direction: "neutral" };
  return { valor: String(Math.abs(v)), direction: v > 0 ? "up" : "down" };
}

export function KpiRow({ kpis }: { kpis: KpiData }) {
  const pontuais = kpis.servicosPontuais;
  // Mês atual no fuso da app (Cuiabá UTC-4) — usado no link de drill-down "Churn do mês"
  const mesAtual = getCurrentMonthYM();

  // LTV helpers — quando não tem churn no mês, valor é null. Mostramos "—"
  // com helper explicando, em vez de um número infinito ou confuso.
  const ltvDisplay = kpis.ltv.valor === null
    ? { node: "—" as React.ReactNode, helper: "Sem churn no mês — LTV indefinido" }
    : {
        node: <Money value={kpis.ltv.valor} noDecimals />,
        helper: `Churn mensal: ${kpis.ltv.churnRatePct.toFixed(1)}%`,
      };

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 lg:grid-cols-4">
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
        label="Ticket médio"
        valor={<Money value={kpis.ticketMedio.valor} noDecimals />}
        helperText="por mensal ativo"
        icon={Receipt}
      />
      <KpiCard
        label="LTV"
        valor={ltvDisplay.node}
        helperText={ltvDisplay.helper}
        icon={InfinityIcon}
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

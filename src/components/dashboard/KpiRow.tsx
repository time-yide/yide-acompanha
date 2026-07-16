import { Wallet, Users, TrendingDown, Percent, Sparkles, DollarSign, Receipt, Clock } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { Money, Count } from "./HiddenValuesContext";
import type { KpiData } from "@/lib/dashboard/queries";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";

function formatDeltaMoney(v: number): { valor: React.ReactNode; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: <Money value={0} noDecimals />, direction: "neutral" };
  return { valor: <Money value={Math.abs(v)} noDecimals />, direction: v > 0 ? "up" : "down" };
}

function formatDeltaCount(v: number): { valor: React.ReactNode; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: <Count value={0} />, direction: "neutral" };
  return { valor: <Count value={Math.abs(v)} />, direction: v > 0 ? "up" : "down" };
}

export function KpiRow({ kpis }: { kpis: KpiData }) {
  const pontuais = kpis.servicosPontuais;
  // Mês atual no fuso da app (Cuiabá UTC-4) - usado no link de drill-down "Churn do mês"
  const mesAtual = getCurrentMonthYM();

  // Tempo médio de casa = 1 / churn mensal (em meses). Sem churn no mês → indefinido.
  const churnPct = kpis.ltv.churnRatePct;
  const tempoDisplay = churnPct <= 0
    ? { node: "-" as React.ReactNode, helper: "Sem churn no mês" }
    : {
        node: `${Math.round(100 / churnPct)} meses` as React.ReactNode,
        helper: `Churn mensal: ${churnPct.toFixed(1)}%`,
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
        valor={<Count value={kpis.clientesAtivos.quantidade} />}
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
        label="Tempo médio de casa"
        valor={tempoDisplay.node}
        helperText={tempoDisplay.helper}
        icon={Clock}
      />
      <KpiCard
        label="Churn do mês"
        valor={<Count value={kpis.churnMes.quantidade} />}
        helperText={<><Money value={kpis.churnMes.valorPerdido} noDecimals /> perdidos</>}
        icon={TrendingDown}
        href={`/clientes?status=churn&churn_mes=${mesAtual}`}
      />
      <KpiCard
        label="Serviços pontuais"
        valor={<Count value={pontuais.ativos} />}
        helperText={<><Count value={pontuais.concluidosMes} /> concluídos no mês</>}
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

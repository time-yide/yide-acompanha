import { Users, TrendingDown, UserPlus, Sparkles } from "lucide-react";
import { KpiCard } from "../KpiCard";

interface Props {
  clientesAtivos: number;
  deltaClientesAtivos: number;
  churnMes: number;
  emAcompanhamento: number;
  pontuaisAtivos: number;
  pontuaisConcluidosMes: number;
}

function deltaCount(v: number): { valor: string; direction: "up" | "down" | "neutral" } {
  if (v === 0) return { valor: "0", direction: "neutral" };
  return { valor: String(Math.abs(v)), direction: v > 0 ? "up" : "down" };
}

/** Mês atual no formato YYYY-MM (BRT). */
function mesAtualBRT(): string {
  const d = new Date();
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * KPIs específicos da ADM — só números, sem soma em R$.
 * Carteira/comissão em valor fica reservada pro sócio.
 */
export function KpiRowAdm({
  clientesAtivos,
  deltaClientesAtivos,
  churnMes,
  emAcompanhamento,
  pontuaisAtivos,
  pontuaisConcluidosMes,
}: Props) {
  const mesAtual = mesAtualBRT();
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <KpiCard
        label="Clientes ativos"
        valor={String(clientesAtivos)}
        delta={deltaCount(deltaClientesAtivos)}
        helperText="mensais"
        icon={Users}
        href="/clientes?status=ativo"
      />
      <KpiCard
        label="Churn do mês"
        valor={String(churnMes)}
        helperText="clientes mensais que sairam"
        icon={TrendingDown}
        href={`/clientes?status=churn&churn_mes=${mesAtual}`}
      />
      <KpiCard
        label="Em acompanhamento"
        valor={String(emAcompanhamento)}
        helperText="onboarding / marco zero"
        icon={UserPlus}
        href="/onboarding"
      />
      <KpiCard
        label="Serviços pontuais"
        valor={String(pontuaisAtivos)}
        helperText={`${pontuaisConcluidosMes} concluídos no mês`}
        icon={Sparkles}
        href="/clientes?status=ativo&modalidade=pontual"
      />
    </div>
  );
}

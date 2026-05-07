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
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Clientes ativos"
        valor={String(clientesAtivos)}
        delta={deltaCount(deltaClientesAtivos)}
        helperText="mensais"
        icon={Users}
      />
      <KpiCard
        label="Churn do mês"
        valor={String(churnMes)}
        helperText="clientes mensais que sairam"
        icon={TrendingDown}
      />
      <KpiCard
        label="Em acompanhamento"
        valor={String(emAcompanhamento)}
        helperText="onboarding / marco zero"
        icon={UserPlus}
      />
      <KpiCard
        label="Serviços pontuais"
        valor={String(pontuaisAtivos)}
        helperText={`${pontuaisConcluidosMes} concluídos no mês`}
        icon={Sparkles}
      />
    </div>
  );
}

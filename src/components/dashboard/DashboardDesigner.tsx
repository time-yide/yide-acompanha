import { FixoCard } from "./personal/FixoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { PeriodoSelector } from "./personal/PeriodoSelector";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { resolvePeriodo, getProducaoNoPeriodo, type Periodo } from "@/lib/dashboard/personal";
import { Palette } from "lucide-react";

interface Props {
  userId: string;
  nome: string;
  periodo?: Periodo;
}

const PERIODO_LABELS: Record<Periodo, string> = {
  mes_atual: "este mês",
  mes_anterior: "mês passado",
  dias_7: "últimos 7 dias",
  total: "no total",
};

export async function DashboardDesigner({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const { fromIso, toIso } = resolvePeriodo(periodo);
  const totalArtes = await getProducaoNoPeriodo(userId, fromIso, toIso, "artes");

  return (
    <HiddenValuesProvider>
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
            <p className="text-sm text-muted-foreground">Sua produção e o que tem em aberto.</p>
          </div>
          <HiddenValueToggle />
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <FixoCard userId={userId} />
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Artes entregues ({PERIODO_LABELS[periodo]})
              </p>
              <PeriodoSelector current={periodo} />
            </div>
            <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold tabular-nums">
              <Palette className="h-5 w-5 text-primary" />
              {totalArtes}
            </p>
          </div>
        </div>

        <MinhasTarefasPendentes userId={userId} />
      </div>
    </HiddenValuesProvider>
  );
}

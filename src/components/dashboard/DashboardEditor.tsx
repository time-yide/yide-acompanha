import { Suspense } from "react";
import { FixoCard } from "./personal/FixoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { PeriodoSelector } from "./personal/PeriodoSelector";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { InstagramPostsSection } from "./sections";
import { resolvePeriodo, getProducaoNoPeriodo, type Periodo } from "@/lib/dashboard/personal";
import { CheckCircle2 } from "lucide-react";

function IgListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
      ))}
    </div>
  );
}

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

export async function DashboardEditor({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const { fromIso, toIso } = resolvePeriodo(periodo);
  const totalConcluidas = await getProducaoNoPeriodo(userId, fromIso, toIso, "tarefas");

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {primeiroNome}</h1>
            <p className="text-sm text-muted-foreground">Sua produção e o que tem em aberto.</p>
          </div>
          <HiddenValueToggle />
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <FixoCard userId={userId} />
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Tarefas concluídas ({PERIODO_LABELS[periodo]})
              </p>
              <PeriodoSelector current={periodo} />
            </div>
            <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold tabular-nums">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {totalConcluidas}
            </p>
          </div>
        </div>

        <MinhasTarefasPendentes userId={userId} />

        <Suspense fallback={<IgListSkeleton />}>
          <InstagramPostsSection assessorId={null} titulo="Postagens no Instagram" />
        </Suspense>
      </div>
    </HiddenValuesProvider>
  );
}

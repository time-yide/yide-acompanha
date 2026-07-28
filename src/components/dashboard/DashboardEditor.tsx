import { Suspense } from "react";
import { FixoCard } from "./personal/FixoCard";
import { MinhasTarefasPendentes } from "./personal/MinhasTarefasPendentes";
import { PeriodoSelector } from "./personal/PeriodoSelector";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { resolvePeriodo, getProducaoNoPeriodo, type Periodo } from "@/lib/dashboard/personal";
import { RemuneracaoSkeleton, ListSkeleton } from "./sections";
import { CheckCircle2 } from "lucide-react";

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

// Cada await de dados vira uma seção async própria, renderizada dentro de
// <Suspense> no shell síncrono abaixo. Antes o componente era `async` e o
// await de getProducaoNoPeriodo bloqueava o primeiro byte da página inteira —
// agora a saudação e o seletor de período saem na hora e cada parte streama
// quando sua query resolve.

async function TarefasConcluidasValueSection({
  userId,
  fromIso,
  toIso,
}: {
  userId: string;
  fromIso: string;
  toIso: string;
}) {
  const totalConcluidas = await getProducaoNoPeriodo(userId, fromIso, toIso, "tarefas");
  return (
    <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold tabular-nums">
      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      {totalConcluidas}
    </p>
  );
}

/**
 * Shell síncrono. Saudação e o seletor de período renderizam imediatamente;
 * o fixo, a contagem de concluídas e as tarefas pendentes streamam via
 * Suspense quando cada query resolve (padrão do DashboardCoord/Comercial).
 */
export function DashboardEditor({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const { fromIso, toIso } = resolvePeriodo(periodo);

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
          <Suspense fallback={<RemuneracaoSkeleton />}>
            <FixoCard userId={userId} />
          </Suspense>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Tarefas concluídas ({PERIODO_LABELS[periodo]})
              </p>
              <PeriodoSelector current={periodo} />
            </div>
            <Suspense fallback={<div className="mt-2 h-9 w-16 animate-pulse rounded-md bg-muted" />}>
              <TarefasConcluidasValueSection userId={userId} fromIso={fromIso} toIso={toIso} />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<ListSkeleton rows={4} />}>
          <MinhasTarefasPendentes userId={userId} />
        </Suspense>
      </div>
    </HiddenValuesProvider>
  );
}

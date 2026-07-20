import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTasks, type TaskFilters } from "@/lib/tarefas/queries";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { nowInAppTz } from "@/lib/datetime/timezone";
import { computeTarefasMetricas, type MetricaTarefaInput } from "@/lib/tarefas/metricas";
import { TarefasMetricasSection } from "@/components/tarefas/metricas/TarefasMetricasSection";
import { buttonVariants } from "@/components/ui/button";

export default async function TarefasMetricasPage() {
  await requireAuth();

  // Sem filtro de mês/aba: métricas de atraso/parada precisam de TODAS as
  // tarefas em aberto (inclusive antigas). Só respeita a unidade ativa.
  const filters: TaskFilters = { unitClientIds: await getClientIdsForActiveUnit() };
  const supabase = await createClient();
  const [tasks, { data: profiles = [] }] = await Promise.all([
    listTasks(filters),
    supabase.from("profiles").select("id, nome").eq("ativo", true),
  ]);

  const input: MetricaTarefaInput[] = tasks.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    status: t.status,
    due_date: t.due_date,
    updated_at: t.updated_at ?? null,
    created_at: t.created_at ?? null,
    completed_at: t.completed_at ?? null,
    atribuido_a: t.atribuido_a ?? null,
  }));

  // "Agora" em Cuiabá (via lib, pra não chamar Date impuro no render): o corte
  // de data do atraso não pula 4h cedo perto da meia-noite.
  const metricas = computeTarefasMetricas(input, nowInAppTz().toISOString());

  const nomePorId: Record<string, string> = {};
  for (const p of (profiles ?? []) as Array<{ id: string; nome: string }>) {
    nomePorId[p.id] = p.nome;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/tarefas"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="Voltar pra Tarefas"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Métricas de tarefas</h1>
            <p className="text-sm text-muted-foreground">Atraso, tempo parada e saúde das entregas</p>
          </div>
        </div>
      </header>

      <TarefasMetricasSection metricas={metricas} nomePorId={nomePorId} />
    </div>
  );
}

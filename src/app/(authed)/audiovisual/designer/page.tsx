import Link from "next/link";
import { ArrowLeft, Palette } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listTasks } from "@/lib/tarefas/queries";
import { getClientIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { TasksGroupedList } from "@/components/tarefas/TasksGroupedList";

const ROLES_QUE_VEEM = [
  "designer", "audiovisual_chefe", "coordenador", "assessor", "adm", "socio",
];

export default async function DesignerPage() {
  const user = await requireAuth();
  if (!ROLES_QUE_VEEM.includes(user.role)) notFound();

  const unitClientIds = await getClientIdsForActiveUnit();
  const arteTasks = await listTasks({
    tipo: ["arte"],
    unitClientIds: unitClientIds,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/audiovisual"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Audiovisual
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Palette className="h-6 w-6" />
            Designer
          </h1>
          <p className="text-sm text-muted-foreground">
            Tarefas de arte (tipo &ldquo;arte&rdquo;) criadas em /tarefas.
          </p>
        </div>
      </header>

      {arteTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa de arte encontrada.
        </div>
      ) : (
        <TasksGroupedList tasks={arteTasks} groupBy="prazo" userRole={user.role} />
      )}
    </div>
  );
}

import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listTasks } from "@/lib/tarefas/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Circle } from "lucide-react";

const priorityClass: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

export default async function ClientTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const tasks = await listTasks({ clientId: id });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tarefas deste cliente</h2>
          <p className="text-xs text-muted-foreground">{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}</p>
        </div>
        <Button asChild size="sm">
          <Link href={`/tarefas/nova?client_id=${id}`}><Plus className="mr-1 h-3.5 w-3.5" />Nova tarefa</Link>
        </Button>
      </header>

      {tasks.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa para este cliente.</Card>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Card className="p-3">
                <Link href={`/tarefas/${t.id}`} className="flex items-center gap-3 hover:underline">
                  {t.status === "concluida" ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
                      {t.titulo}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className={priorityClass[t.prioridade]}>{t.prioridade}</Badge>
                      {/* @ts-expect-error nested */}
                      {t.atribuido?.nome && <span>→ {t.atribuido.nome}</span>}
                      {t.due_date && <span>· prazo: {new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

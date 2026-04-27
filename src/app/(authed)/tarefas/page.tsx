import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listTasks } from "@/lib/tarefas/queries";
import { TasksList } from "@/components/tarefas/TasksList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TarefasPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const filtro = params.filtro ?? "minhas";

  let tasks;
  if (filtro === "minhas") tasks = await listTasks({ atribuidoA: user.id, status: "aberta" });
  else if (filtro === "criadas") tasks = await listTasks({ criadoPor: user.id });
  else if (filtro === "concluidas") tasks = await listTasks({ atribuidoA: user.id, status: "concluida" });
  else tasks = await listTasks();

  const tab = (slug: string, label: string) => (
    <Link
      key={slug}
      href={`/tarefas?filtro=${slug}`}
      className={filtro === slug ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Gestão de tarefas entre coordenadores e assessores.</p>
        </div>
        <Link href="/tarefas/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" />Nova tarefa
          </Button>
        </Link>
      </header>

      <div className="flex gap-3 text-sm">
        {tab("minhas", "Minhas (em aberto)")}
        <span className="text-muted-foreground">·</span>
        {tab("criadas", "Que eu criei")}
        <span className="text-muted-foreground">·</span>
        {tab("concluidas", "Concluídas (minhas)")}
        <span className="text-muted-foreground">·</span>
        {tab("todas", "Todas")}
      </div>

      <TasksList tasks={tasks} />
    </div>
  );
}

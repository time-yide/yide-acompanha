import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTasksForClient } from "@/lib/tarefas/queries";
import { TasksList } from "@/components/tarefas/TasksList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ClienteTarefasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, nome")
    .eq("id", id)
    .single();
  if (!client) notFound();

  const tasks = await listTasksForClient(id);
  const abertas = tasks.filter((t) => t.status !== "concluida");
  const concluidas = tasks.filter((t) => t.status === "concluida");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Tarefas</h2>
          <p className="text-sm text-muted-foreground">
            {abertas.length} em aberto · {concluidas.length} concluídas
          </p>
        </div>
        <Link href={`/tarefas/nova?client_id=${id}`}>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />Nova tarefa
          </Button>
        </Link>
      </header>

      {abertas.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Em aberto</h3>
          <TasksList tasks={abertas} />
        </section>
      )}

      {concluidas.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Concluídas</h3>
          <TasksList tasks={concluidas} />
        </section>
      )}

      {tasks.length === 0 && (
        <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Sem tarefas vinculadas a este cliente.
        </p>
      )}
    </div>
  );
}

import { ListTodo } from "lucide-react";
import { TaskCard } from "@/components/tarefas/TaskCard";
import type { TaskRow } from "@/lib/tarefas/queries";

/**
 * Bloco de tarefas de vídeo pedidas por /tarefas (sem gravação), mostrado
 * abaixo das capturas nas abas do Audiovisual. Clicar abre a tarefa.
 */
export function TarefasVideoAvulsasSection({
  titulo,
  descricao,
  tasks,
  userRole,
}: {
  titulo: string;
  descricao: string;
  tasks: TaskRow[];
  userRole: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2 border-t pt-5">
        <ListTodo className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">
            {titulo} <span className="font-normal text-muted-foreground">· {tasks.length}</span>
          </h2>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
          Nenhuma tarefa aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} userRole={userRole} />
          ))}
        </div>
      )}
    </section>
  );
}

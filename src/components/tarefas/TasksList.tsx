import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "./PriorityBadge";
import { Check, Circle } from "lucide-react";

interface Task {
  id: string;
  titulo: string;
  prioridade: string;
  status: string;
  due_date: string | null;
  client_id: string | null;
  // @ts-expect-error nested
  atribuido?: { nome: string } | null;
  // @ts-expect-error nested
  cliente?: { id: string; nome: string } | null;
}

export function TasksList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa.</Card>;
  }

  return (
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
                  <PriorityBadge prioridade={t.prioridade} />
                  {t.atribuido?.nome && <span>→ {t.atribuido.nome}</span>}
                  {t.cliente?.nome && <span>· cliente: {t.cliente.nome}</span>}
                  {t.due_date && <span>· prazo: {new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

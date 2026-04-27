import { notFound } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import type { CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTaskById } from "@/lib/tarefas/queries";
import { updateTaskAction, toggleTaskCompletionAction, deleteTaskAction } from "@/lib/tarefas/actions";
import { TaskForm } from "@/components/tarefas/TaskForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function isPrivileged(user: CurrentUser): boolean {
  return user.role === "adm" || user.role === "socio";
}

export default async function TarefaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  let task;
  try { task = await getTaskById(id); } catch { notFound(); }

  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  const canEdit = task.criado_por === user.id || task.atribuido_a === user.id || isPrivileged(user);
  const canDelete = task.criado_por === user.id || isPrivileged(user);

  async function toggle() {
    "use server";
    await toggleTaskCompletionAction(id);
  }

  async function deleteTask() {
    "use server";
    await deleteTaskAction(id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Detalhes da tarefa</h1>
        <div className="flex items-center gap-2">
          {canEdit && (
            <form action={toggle}>
              <Button type="submit" variant={task.status === "concluida" ? "outline" : "default"}>
                {task.status === "concluida" ? "Reabrir" : "Marcar como concluída"}
              </Button>
            </form>
          )}
          {canDelete && (
            <form action={deleteTask}>
              <Button type="submit" variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </form>
          )}
        </div>
      </header>

      {task.client_id && task.cliente?.nome && (
        <p className="text-sm">Vinculada ao cliente <Link href={`/clientes/${task.client_id}`} className="text-primary hover:underline">{task.cliente.nome}</Link></p>
      )}

      <Card className="p-6">
        {canEdit ? (
          <TaskForm
            action={updateTaskAction}
            profiles={profiles ?? []}
            clientes={clientes ?? []}
            defaults={{
              id: task.id,
              titulo: task.titulo,
              descricao: task.descricao,
              prioridade: task.prioridade,
              status: task.status,
              atribuido_a: task.atribuido_a,
              client_id: task.client_id,
              due_date: task.due_date,
            }}
            isEdit
            submitLabel="Salvar alterações"
          />
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{task.titulo}</h2>
            {task.descricao && <p className="whitespace-pre-wrap text-sm">{task.descricao}</p>}
            <div className="text-xs text-muted-foreground">
              Status: {task.status} · Atribuído a {task.atribuido?.nome ?? "desconhecido"} · Criado por {task.criador?.nome ?? "desconhecido"}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

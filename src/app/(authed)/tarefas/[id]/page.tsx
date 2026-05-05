import { notFound } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import type { CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTaskById } from "@/lib/tarefas/queries";
import { updateTaskAction, deleteTaskAction } from "@/lib/tarefas/actions";
import { TaskForm } from "@/components/tarefas/TaskForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompleteTaskButton } from "@/components/tarefas/CompleteTaskButton";

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
            <CompleteTaskButton
              taskId={id}
              isCompleted={task.status === "concluida"}
              userRole={user.role}
            />
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
              participantes_ids: task.participantes_ids ?? [],
              links: task.links ?? [],
              attachment_urls: task.attachment_urls ?? [],
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

      {(task.links?.length ?? 0) > 0 && (
        <Card className="p-5 space-y-2">
          <h3 className="text-sm font-semibold">Links de referência</h3>
          <ul className="space-y-1 text-sm">
            {task.links?.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {l.label || l.url}
                </a>
                {l.label && <span className="ml-2 text-xs text-muted-foreground">{l.url}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(task.attachment_urls?.length ?? 0) > 0 && (
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold">Anexos</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {task.attachment_urls?.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="anexo" className="h-full w-full object-cover transition-transform hover:scale-105" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

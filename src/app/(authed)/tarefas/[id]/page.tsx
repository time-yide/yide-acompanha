import Link from "next/link";
import { ArrowLeft, CheckCircle2, History, Pencil, SearchX, Trash2 } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import type { CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTaskById, listTaskRevisoes, listTaskComments, type TaskAprovacao, type TaskFormato, type TaskStatus } from "@/lib/tarefas/queries";
import { updateTaskAction, deleteTaskAction } from "@/lib/tarefas/actions";
import { TaskForm } from "@/components/tarefas/TaskForm";
import { PriorityBadge } from "@/components/tarefas/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompleteTaskButton } from "@/components/tarefas/CompleteTaskButton";
import { ApprovalCard } from "@/components/tarefas/ApprovalCard";
import { RevisionsTimeline } from "@/components/tarefas/RevisionsTimeline";
import { CommentsPanel } from "@/components/tarefas/CommentsPanel";
import { TaskRealtimeWatcher } from "@/components/tarefas/TaskRealtimeWatcher";
import { Linkify } from "@/lib/utils/linkify";

function isPrivileged(user: CurrentUser): boolean {
  return (
    user.role === "adm" ||
    user.role === "socio" ||
    user.role === "audiovisual_chefe"
  );
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluído Operacional",
  em_aprovacao: "Aprovação Cliente",
  alteracao: "Alteração",
  aprovada: "Aprovado",
  agendado: "Agendado",
  postada: "Postado",
};

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export default async function TarefaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const user = await requireAuth();

  let task;
  try {
    task = await getTaskById(id);
  } catch {
    // Tarefa não existe (foi excluída, soft-deleted ou ID inválido).
    // Renderiza página amigável em vez do 404 padrão do Next, com link
    // de volta + explicação do que provavelmente aconteceu.
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <SearchX className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Tarefa não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            Essa tarefa foi excluída ou o link tá apontando pra um ID que não existe.
            Se você lembra do contexto, talvez ela esteja na <Link href="/lixeira" className="text-primary hover:underline">Lixeira</Link>.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/tarefas">
            <Button variant="outline">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar pra Tarefas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = task.criado_por === user.id || task.atribuido_a === user.id || isPrivileged(user);
  const canDelete = task.criado_por === user.id || isPrivileged(user);
  const isEditing = edit === "1" && canEdit;

  const supabase = await createClient();
  const isApprovalTask = task.tipo === "video" || task.tipo === "arte";
  const isMember =
    task.criado_por === user.id ||
    task.atribuido_a === user.id ||
    (Array.isArray(task.participantes_ids) && task.participantes_ids.includes(user.id)) ||
    isPrivileged(user);

  const [{ data: profiles = [] }, { data: clientes = [] }, revisoes, comments] = await Promise.all([
    supabase.from("profiles").select("id, nome, role").eq("ativo", true).order("nome"),
    isEditing
      ? supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    isApprovalTask && !isEditing ? listTaskRevisoes(id) : Promise.resolve([]),
    !isEditing && isMember ? listTaskComments(id) : Promise.resolve([]),
  ]);

  const isExecutor =
    task.atribuido_a === user.id ||
    (Array.isArray(task.participantes_ids) && task.participantes_ids.includes(user.id));
  const isApprover = task.criado_por === user.id || isPrivileged(user);
  const canMarkPosted = isMember; // qualquer um da tarefa pode marcar como postado

  async function deleteTask() {
    "use server";
    await deleteTaskAction(id);
  }

  const participantesExtras = (task.participantes_ids ?? []).filter((pid) => pid !== task.atribuido_a);
  const participantesNomes = participantesExtras.map(
    (pid) => (profiles ?? []).find((p) => p.id === pid)?.nome ?? null,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Subscribe a UPDATEs da task: status, atribuição, aprovação, etc.
          Quando muda, força re-render da página com dados frescos. */}
      <TaskRealtimeWatcher taskId={id} />
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Detalhes da tarefa</h1>
        <div className="flex items-center gap-2">
          {canEdit && !isEditing && (
            <Link href={`/tarefas/${id}?edit=1`}>
              <Button type="button" variant="outline">
                <Pencil className="h-4 w-4 mr-1" />
                Fazer ajustes
              </Button>
            </Link>
          )}
          {["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"].includes(user.role) && (
            <Link href={`/tarefas/${id}/historico`}>
              <Button type="button" variant="ghost" size="sm">
                <History className="h-4 w-4 mr-1" />
                Histórico
              </Button>
            </Link>
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
        <p className="text-sm">
          Vinculada ao cliente{" "}
          <Link href={`/clientes/${task.client_id}`} className="text-primary hover:underline">
            {task.cliente.nome}
          </Link>
        </p>
      )}

      {isEditing ? (
        <Card className="p-6">
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
              tipo: task.tipo ?? "geral",
              formatos: task.formatos ?? [],
              atribuido_a: task.atribuido_a,
              client_id: task.client_id,
              due_date: task.due_date,
              participantes_ids: task.participantes_ids ?? [],
              links: task.links ?? [],
              attachment_urls: task.attachment_urls ?? [],
            }}
            isEdit
            submitLabel="Salvar alterações"
            cancelHref={`/tarefas/${id}`}
          />
        </Card>
      ) : (
        <>
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold leading-tight">{task.titulo}</h2>
              {task.descricao ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground"><Linkify text={task.descricao} /></p>
              ) : (
                <p className="text-sm italic text-muted-foreground">Sem descrição.</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 border-t pt-5 text-sm sm:grid-cols-2">
              <Field label="Responsável pela execução" value={task.atribuido?.nome ?? ""} />
              <Field label="Criado por" value={task.criador?.nome ?? ""} />
              <Field
                label="Prioridade"
                node={<PriorityBadge prioridade={task.prioridade} />}
              />
              <Field label="Prazo" value={formatDateBR(task.due_date)} />
              <Field
                label="Status"
                node={<Badge variant="outline">{STATUS_LABEL[task.status] ?? task.status}</Badge>}
              />
              {task.cliente?.nome && (
                <Field
                  label="Cliente"
                  node={
                    <Link href={`/clientes/${task.client_id}`} className="text-primary hover:underline">
                      {task.cliente.nome}
                    </Link>
                  }
                />
              )}
              {participantesExtras.length > 0 && (
                <div className="sm:col-span-2 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Atribuídos adicionais</p>
                  <div className="flex flex-wrap gap-1.5">
                    {participantesNomes.map((nome, i) => (
                      <Badge key={participantesExtras[i]} variant="outline">
                        {nome ?? participantesExtras[i].slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {isApprovalTask && task.status_aprovacao && (
            <ApprovalCard
              taskId={id}
              tipo={task.tipo as "video" | "arte"}
              formatos={(task.formatos ?? []) as TaskFormato[]}
              statusAprovacao={task.status_aprovacao as TaskAprovacao}
              status={task.status as TaskStatus}
              aprovadaEm={task.aprovada_em ?? null}
              isExecutor={isExecutor}
              isApprover={isApprover}
              canMarkPosted={canMarkPosted}
            />
          )}

          {task.drive_link && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Material entregue
              </p>
              <a
                href={task.drive_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline underline-offset-2 break-all hover:text-primary/80"
              >
                {task.drive_link}
              </a>
            </div>
          )}

          {task.entrega_observacoes && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observações da entrega
              </p>
              <p className="text-sm whitespace-pre-wrap">
                <Linkify text={task.entrega_observacoes} />
              </p>
            </div>
          )}

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

          {isApprovalTask && <RevisionsTimeline revisoes={revisoes} />}

          {isMember && (
            <CommentsPanel
              taskId={id}
              initialComments={comments}
              canComment={isMember}
              currentUser={{ id: user.id, nome: user.nome, avatar_url: user.avatarUrl }}
            />
          )}

          {canEdit && (task.status === "aberta" || task.status === "em_andamento" || task.status === "concluida") && (
            <Card
              className={
                task.status === "concluida"
                  ? "mt-8 border-muted-foreground/30 bg-muted/30 p-5"
                  : "mt-8 border-emerald-500/40 bg-emerald-500/5 p-5"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className={
                      task.status === "concluida"
                        ? "mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                        : "mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400"
                    }
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">
                      {task.status === "concluida" ? "Tarefa concluída" : "Finalizar tarefa"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.status === "concluida"
                        ? "Reabra caso ainda haja algo pendente."
                        : "Marque quando todos os itens estiverem entregues."}
                    </p>
                  </div>
                </div>
                <CompleteTaskButton
                  taskId={id}
                  isCompleted={task.status === "concluida"}
                  size="lg"
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  node,
}: {
  label: string;
  value?: string;
  node?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm">{node ?? value ?? ""}</div>
    </div>
  );
}

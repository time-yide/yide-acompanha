import Link from "next/link";
import { ExternalLink, History } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import type { CurrentUser } from "@/lib/auth/session";
import {
  getTaskById,
  listTaskComments,
  listTaskRevisoes,
  type TaskAprovacao,
  type TaskFormato,
  type TaskStatus,
} from "@/lib/tarefas/queries";
import { TaskModalShell } from "@/components/tarefas/TaskModalShell";
import { PriorityBadge } from "@/components/tarefas/PriorityBadge";
import { CommentsPanel } from "@/components/tarefas/CommentsPanel";
import { CompleteTaskButton } from "@/components/tarefas/CompleteTaskButton";
import { ApprovalCard } from "@/components/tarefas/ApprovalCard";
import { RevisionsTimeline } from "@/components/tarefas/RevisionsTimeline";
import { TaskRealtimeWatcher } from "@/components/tarefas/TaskRealtimeWatcher";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Linkify } from "@/lib/utils/linkify";

function isPrivileged(user: CurrentUser): boolean {
  return user.role === "adm" || user.role === "socio" || user.role === "audiovisual_chefe";
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluído Operacional",
  em_aprovacao: "Aprovação",
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

// `[id]` é dinâmico no router e captura QUALQUER segment-filho de /tarefas —
// inclusive irmãos literais como /tarefas/nova. Sem este guard, o slot @modal
// tenta buscar uma tarefa com id="nova" e mostra "Tarefa não encontrada"
// sobreposto à página real de criação. Só intercepta UUIDs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TarefaModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return null;
  const user = await requireAuth();

  let task;
  try {
    task = await getTaskById(id);
  } catch {
    return (
      <TaskModalShell title="Tarefa não encontrada">
        <div className="space-y-3 py-4 text-center">
          <h2 className="text-lg font-semibold">Tarefa não encontrada</h2>
          <p className="text-sm text-muted-foreground">
            Pode ter sido excluída. Veja em{" "}
            <Link href="/lixeira" className="text-primary hover:underline">
              Lixeira
            </Link>
            .
          </p>
        </div>
      </TaskModalShell>
    );
  }

  const canEdit =
    task.criado_por === user.id || task.atribuido_a === user.id || isPrivileged(user);
  const isApprovalTask = task.tipo === "video" || task.tipo === "arte";
  const isMember =
    task.criado_por === user.id ||
    task.atribuido_a === user.id ||
    (Array.isArray(task.participantes_ids) && task.participantes_ids.includes(user.id)) ||
    isPrivileged(user);
  const isExecutor =
    task.atribuido_a === user.id ||
    (Array.isArray(task.participantes_ids) && task.participantes_ids.includes(user.id));
  const isApprover = task.criado_por === user.id || isPrivileged(user);

  const [revisoes, comments] = await Promise.all([
    isApprovalTask ? listTaskRevisoes(id) : Promise.resolve([]),
    isMember ? listTaskComments(id) : Promise.resolve([]),
  ]);

  return (
    <TaskModalShell title={task.titulo}>
      <TaskRealtimeWatcher taskId={id} />

      <div className="space-y-5">
        {/* Header: título + status + ações */}
        <div className="space-y-2 pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{STATUS_LABEL[task.status] ?? task.status}</Badge>
            <PriorityBadge prioridade={task.prioridade} />
          </div>
          <h2 className="text-xl font-semibold leading-tight">{task.titulo}</h2>
          {task.cliente?.nome && (
            <p className="text-sm">
              <span className="text-muted-foreground">Cliente: </span>
              <Link
                href={`/clientes/${task.client_id}`}
                className="text-primary hover:underline"
              >
                {task.cliente.nome}
              </Link>
            </p>
          )}
        </div>

        {/* Descrição */}
        {task.descricao ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            <Linkify text={task.descricao} />
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Sem descrição.</p>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <MiniField label="Responsável" value={task.atribuido?.nome ?? "—"} />
          <MiniField label="Criado por" value={task.criador?.nome ?? "—"} />
          <MiniField label="Prazo" value={formatDateBR(task.due_date) || "—"} />
        </div>

        {/* Approval workflow (video/arte) */}
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
            canMarkPosted={isMember}
          />
        )}

        {/* Material entregue */}
        {task.drive_link && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Material entregue
            </p>
            <a
              href={task.drive_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2 break-all hover:text-primary/80"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              {task.drive_link}
            </a>
          </div>
        )}

        {/* Revisions */}
        {isApprovalTask && revisoes.length > 0 && <RevisionsTimeline revisoes={revisoes} />}

        {/* Quick complete (apenas estados antes da aprovação) */}
        {canEdit &&
          (task.status === "aberta" ||
            task.status === "em_andamento" ||
            task.status === "concluida") && (
            <div className="flex items-center justify-end border-t pt-3">
              <CompleteTaskButton
                taskId={id}
                isCompleted={task.status === "concluida"}
                size="sm"
              />
            </div>
          )}

        {/* Comments (membro) */}
        {isMember && (
          <CommentsPanel
            taskId={id}
            initialComments={comments}
            canComment={isMember}
            currentUser={{ id: user.id, nome: user.nome, avatar_url: user.avatarUrl }}
          />
        )}

        {/* Footer: link pra página completa (edit, anexos, histórico).
            Usa <a> em vez de <Link> pra "Ver página completa" — Link
            client-side dispara o intercepting route de novo (mesma rota
            /tarefas/[id]), prendendo o usuário no modal. <a> força full
            page nav, escapando da intercepção e renderizando o page.tsx
            regular com formulário de edit e tudo mais. */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Link
            href={`/tarefas/${id}/historico`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <History className="mr-1 h-4 w-4" />
            Histórico
          </Link>
          <a
            href={canEdit ? `/tarefas/${id}?edit=1` : `/tarefas/${id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {canEdit ? "Editar / Ver página completa" : "Ver página completa"}
          </a>
        </div>
      </div>
    </TaskModalShell>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

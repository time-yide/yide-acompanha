// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { NotificationType } from "./schema";
import type { Database } from "@/types/database";

export function shouldNotify(recipientId: string, sourceId: string): boolean {
  return recipientId !== sourceId;
}

interface NotifyArgs {
  recipientId: string;
  sourceId: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  link?: string;
}

async function notify({ recipientId, sourceId, tipo, titulo, mensagem, link }: NotifyArgs): Promise<void> {
  if (!shouldNotify(recipientId, sourceId)) return;

  const supabase = createServiceRoleClient();
  const insert: Database["public"]["Tables"]["notifications"]["Insert"] = {
    user_id: recipientId,
    tipo,
    titulo,
    mensagem,
    link: link ?? null,
  };
  const { error } = await supabase.from("notifications").insert(insert);
  if (error) console.error("[notificacoes/trigger] insert failed:", error.message);
}

export async function notifyTaskAssigned(args: {
  taskId: string;
  assigneeId: string;
  creatorId: string;
  taskTitle: string;
  creatorName: string;
}): Promise<void> {
  await notify({
    recipientId: args.assigneeId,
    sourceId: args.creatorId,
    tipo: "task_assigned",
    titulo: "Nova tarefa atribuída a você",
    mensagem: `${args.creatorName} atribuiu: "${args.taskTitle}"`,
    link: `/tarefas/${args.taskId}`,
  });
}

export async function notifyTaskCompleted(args: {
  taskId: string;
  completerId: string;
  creatorId: string;
  taskTitle: string;
  completerName: string;
}): Promise<void> {
  await notify({
    recipientId: args.creatorId,
    sourceId: args.completerId,
    tipo: "task_completed",
    titulo: "Tarefa concluída",
    mensagem: `${args.completerName} concluiu: "${args.taskTitle}"`,
    link: `/tarefas/${args.taskId}`,
  });
}

import { revalidatePath, revalidateTag } from "next/cache";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type DestinoTarefa = "alteracao" | "em_aprovacao" | "aprovada";

/** Mapa destino → colunas da tarefa. Pura (testável isolada). */
export function statusDaTarefaPorDestino(destino: DestinoTarefa): { status: string; status_aprovacao: string } {
  switch (destino) {
    case "alteracao": return { status: "alteracao", status_aprovacao: "ajustes_solicitados" };
    case "em_aprovacao": return { status: "em_aprovacao", status_aprovacao: "em_analise" };
    case "aprovada": return { status: "aprovada", status_aprovacao: "aprovada" };
  }
}

/**
 * Espelha a decisão do review na tarefa vinculada. `actor` = membro da equipe;
 * `null` = ação veio do CLIENTE (link público) — nesse caso não grava
 * task_revisoes (autor_id é NOT NULL/FK e o cliente não é profile) e as
 * notificações vão pra equipe da tarefa. Best-effort: sem tarefa vinculada, sai.
 */
export async function syncTarefaComReview(
  sb: SB,
  reviewId: string,
  destino: DestinoTarefa,
  actor: { id: string; nome: string } | null,
): Promise<void> {
  const { data: rv } = await sb.from("review_video").select("task_id").eq("id", reviewId).maybeSingle();
  const taskId = rv?.task_id as string | null | undefined;
  if (!taskId) return;
  const { data: task } = await sb
    .from("tasks")
    .select("id, titulo, atribuido_a, participantes_ids, criado_por, client_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;

  const { status, status_aprovacao } = statusDaTarefaPorDestino(destino);
  await sb.from("tasks").update({ status, status_aprovacao }).eq("id", taskId);

  // Timeline só quando é a equipe (autor_id NOT NULL). Cliente não vira linha aqui.
  if (actor) {
    await sb.from("task_revisoes").insert({
      task_id: taskId,
      autor_id: actor.id,
      tipo: destino === "alteracao" ? "ajustes" : "envio",
      observacoes: destino === "alteracao" ? "Alterações pedidas no Frame — ver comentários no vídeo." : null,
    });
  }

  const participantes = (task.participantes_ids ?? []) as string[];
  const equipe = [task.atribuido_a, task.criado_por, ...participantes].filter(
    (id: string | null): id is string => !!id && id !== actor?.id,
  );
  const dedup = Array.from(new Set(equipe));

  if (destino === "alteracao") {
    const msg = actor
      ? "Foram pedidas alterações no Frame — veja os comentários no vídeo."
      : "O cliente pediu alterações — veja os comentários no vídeo.";
    if (dedup.length > 0) {
      await dispatchNotification({
        evento_tipo: "task_alteracao_solicitada",
        titulo: actor ? `Ajustes solicitados: ${task.titulo}` : `Cliente pediu alteração: ${task.titulo}`,
        mensagem: msg,
        link: `/tarefas/${taskId}`,
        user_ids_extras: dedup,
        source_user_id: actor?.id,
      });
    }
  } else if (destino === "em_aprovacao") {
    if (task.criado_por && task.criado_por !== actor?.id) {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Vídeo aprovado internamente",
        mensagem: `${actor?.nome ?? "A equipe"} aprovou no Frame e enviou pra aprovação: "${task.titulo}"`,
        link: `/tarefas/${taskId}`,
        user_ids_extras: [task.criado_por],
        source_user_id: actor?.id,
      });
    }
  } else {
    // aprovada (pelo cliente)
    if (dedup.length > 0) {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Cliente aprovou o vídeo",
        mensagem: `O cliente aprovou o vídeo: "${task.titulo}".`,
        link: `/tarefas/${taskId}`,
        user_ids_extras: dedup,
        source_user_id: actor?.id,
      });
    }
  }

  revalidateTag("tasks", "default");
  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/tarefas");
  if (task.client_id) revalidatePath(`/clientes/${task.client_id}/tarefas`);
}

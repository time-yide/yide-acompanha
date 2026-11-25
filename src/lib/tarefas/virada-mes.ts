import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWebPushToUser } from "@/lib/push/server";
import { revalidateTag } from "next/cache";

// Virada de mês das tarefas:
// - No último dia útil do mês, quem tem tarefa em aberto recebe um aviso
//   pra finalizar o que conseguir.
// - No dia 1º, o que ficou em aberto ganha prazo no 1º dia útil do mês novo
//   (mesmo status, mesma pessoa). Tarefa que já tem prazo mais pra frente
//   fica como está.

/** Status que contam como "finalizada" — o resto é tarefa em aberto. */
const STATUS_FINALIZADOS = "(concluida,postada)";

export async function avisarUltimoDiaUtil(): Promise<{ avisados: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: tarefas, error } = await sb
    .from("tasks")
    .select("atribuido_a")
    .not("status", "in", STATUS_FINALIZADOS);
  if (error) throw new Error(`[virada-mes] listar tarefas: ${error.message}`);

  const porPessoa = new Map<string, number>();
  for (const t of (tarefas ?? []) as Array<{ atribuido_a: string | null }>) {
    if (!t.atribuido_a) continue;
    porPessoa.set(t.atribuido_a, (porPessoa.get(t.atribuido_a) ?? 0) + 1);
  }
  if (porPessoa.size === 0) return { avisados: 0 };

  const { data: ativos } = await sb
    .from("profiles")
    .select("id")
    .in("id", [...porPessoa.keys()])
    .eq("ativo", true);
  const ativosIds = ((ativos ?? []) as Array<{ id: string }>).map((p) => p.id);

  const titulo = "Último dia útil do mês";
  let avisados = 0;
  for (const userId of ativosIds) {
    const qtd = porPessoa.get(userId) ?? 0;
    const mensagem =
      qtd === 1
        ? "Você tem 1 tarefa em aberto. Finalize e marque como concluída hoje — o que ficar em aberto passa pro mês que vem."
        : `Você tem ${qtd} tarefas em aberto. Finalize e marque como concluídas hoje — o que ficar em aberto passa pro mês que vem.`;

    const { error: insErr } = await sb.from("notifications").insert({
      user_id: userId,
      tipo: "task_overdue",
      titulo,
      mensagem,
      link: "/tarefas",
      prioridade: "urgente",
    });
    if (insErr) {
      console.error("[virada-mes] aviso falhou:", insErr.message);
      continue;
    }
    avisados++;

    try {
      await sendWebPushToUser(userId, {
        title: titulo,
        body: mensagem,
        url: "/tarefas",
        tag: "virada-mes-tarefas",
        urgent: true,
      });
    } catch (e) {
      console.error("[virada-mes] push falhou:", e);
    }
  }

  revalidateTag("notifications", "default");
  return { avisados };
}

/**
 * Passa as tarefas em aberto pro mês novo: prazo vazio ou antes de
 * `novoPrazo` vira `novoPrazo` (1º dia útil do mês).
 */
export async function passarTarefasProMes(novoPrazo: string): Promise<{ movidas: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: tarefas, error } = await sb
    .from("tasks")
    .select("id")
    .not("status", "in", STATUS_FINALIZADOS)
    .or(`due_date.is.null,due_date.lt.${novoPrazo}`);
  if (error) throw new Error(`[virada-mes] listar tarefas: ${error.message}`);

  const ids = ((tarefas ?? []) as Array<{ id: string }>).map((t) => t.id);
  let movidas = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const { data: up, error: upErr } = await sb
      .from("tasks")
      .update({ due_date: novoPrazo })
      .in("id", ids.slice(i, i + 100))
      .select("id");
    if (upErr) throw new Error(`[virada-mes] atualizar prazo: ${upErr.message}`);
    movidas += (up ?? []).length;
  }

  revalidateTag("tasks", "default");
  return { movidas };
}

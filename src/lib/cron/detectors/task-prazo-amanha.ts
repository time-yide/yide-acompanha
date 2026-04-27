// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { localIsoDate } from "@/lib/utils/date";

export async function detectTasksDuesoon(counters: { task_prazo_amanha: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const tomorrow = localIsoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const { data } = await supabase
    .from("tasks")
    .select("id, titulo, atribuido_a, status")
    .eq("due_date", tomorrow)
    .neq("status", "concluida");

  for (const t of (data ?? []) as Array<{ id: string; titulo: string; atribuido_a: string }>) {
    await dispatchNotification({
      evento_tipo: "task_prazo_amanha",
      titulo: "Tarefa vence amanhã",
      mensagem: `"${t.titulo}" tem prazo amanhã`,
      link: `/tarefas/${t.id}`,
      user_ids_extras: [t.atribuido_a],
    });
    counters.task_prazo_amanha++;
  }
}

// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { localIsoDate } from "@/lib/utils/date";

export async function detectOverdueTasks(counters: { task_overdue: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const today = localIsoDate();

  const { data } = await supabase
    .from("tasks")
    .select("id, titulo, atribuido_a, status, due_date")
    .lt("due_date", today)
    .neq("status", "concluida");

  for (const t of (data ?? []) as Array<{ id: string; titulo: string; atribuido_a: string }>) {
    await dispatchNotification({
      evento_tipo: "task_overdue",
      titulo: "Tarefa atrasada",
      mensagem: `"${t.titulo}" está atrasada`,
      link: `/tarefas/${t.id}`,
      user_ids_extras: [t.atribuido_a],
    });
    counters.task_overdue++;
  }
}

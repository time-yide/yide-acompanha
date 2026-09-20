import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { getTodayDate, formatDateBR } from "@/lib/datetime/timezone";

export async function sendLembreteDeadline(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getTodayDate(tomorrow);

  const { data: tasks } = await sb
    .from("tasks")
    .select("id, titulo, due_date, atribuido_a, client_id, clients(nome)")
    .eq("due_date", tomorrowStr)
    .not("status", "in", '("concluida","aprovada","postada")')
    .not("atribuido_a", "is", null);

  let sent = 0;
  let skipped = 0;

  const byAssignee = new Map<string, Array<{ titulo: string; clientNome: string | null }>>();

  for (const task of tasks ?? []) {
    const assignee = task.atribuido_a as string;
    const list = byAssignee.get(assignee) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientNome = (task as any).clients?.nome ?? null;
    list.push({ titulo: task.titulo, clientNome });
    byAssignee.set(assignee, list);
  }

  if (byAssignee.size === 0) return { sent: 0, skipped: 0 };

  const assigneeIds = [...byAssignee.keys()];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", assigneeIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; nome: string; telefone: string | null }) => [p.id, p]),
  );

  for (const [assigneeId, taskList] of byAssignee) {
    const profile = profileMap.get(assigneeId);
    if (!profile?.telefone) {
      skipped += taskList.length;
      continue;
    }

    const lines = [
      `⏰ *Lembrete: tarefas vencem amanhã!*`,
      ``,
      `${profile.nome?.split(" ")[0] ?? ""}, você tem *${taskList.length}* tarefa(s) com prazo pra *${formatDateBR(tomorrowStr)}*:`,
      ``,
    ];

    for (const t of taskList) {
      const cliente = t.clientNome ? ` (${t.clientNome})` : "";
      lines.push(`• ${t.titulo}${cliente}`);
    }

    lines.push(``);
    lines.push(`Bora finalizar! 💪`);

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

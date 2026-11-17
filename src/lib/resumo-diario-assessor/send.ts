import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import {
  formatDateBR,
  formatTimeBR,
  getTodayDate,
  getDayBoundariesIso,
} from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendResumoDiarioAssessor(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const today = getTodayDate();
  const { fromIso, toIso } = getDayBoundariesIso(today);

  const { data: assessores } = await sb
    .from("profiles")
    .select("id, nome, telefone, role")
    .in("role", ["assessor", "assessor_ecommerce"])
    .not("telefone", "is", null);

  let sent = 0;
  let skipped = 0;

  for (const assessor of assessores ?? []) {
    if (!assessor.telefone) {
      skipped++;
      continue;
    }

    const [eventsRes, tasksRes, tasksPendingRes] = await Promise.all([
      sb
        .from("calendar_events")
        .select("titulo, inicio, sub_calendar, clients(nome)")
        .gte("inicio", fromIso)
        .lt("inicio", toIso)
        .is("deleted_at", null)
        .or(`criado_por.eq.${assessor.id},participantes_ids.cs.{${assessor.id}}`)
        .order("inicio"),
      sb
        .from("tasks")
        .select("titulo, due_date, clients(nome)")
        .eq("atribuido_a", assessor.id)
        .eq("due_date", today)
        .not("status", "in", '("concluida","aprovada","postada")'),
      sb
        .from("tasks")
        .select("id")
        .eq("atribuido_a", assessor.id)
        .lt("due_date", today)
        .not("status", "in", '("concluida","aprovada","postada")')
        .not("due_date", "is", null),
    ]);

    const events = (eventsRes.data ?? []) as Array<{
      titulo: string;
      inicio: string;
      sub_calendar: string;
      clients: { nome: string } | null;
    }>;
    const todayTasks = (tasksRes.data ?? []) as Array<{
      titulo: string;
      due_date: string;
      clients: { nome: string } | null;
    }>;
    const overdueTasks = (tasksPendingRes.data ?? []) as Array<{ id: string }>;

    if (events.length === 0 && todayTasks.length === 0 && overdueTasks.length === 0) {
      skipped++;
      continue;
    }

    const lines: string[] = [
      `☀️ *Bom dia, ${assessor.nome?.split(" ")[0] ?? ""}!*`,
      ``,
      `📅 *${formatDateBR(today)}* — seu resumo do dia:`,
      ``,
    ];

    if (events.length > 0) {
      lines.push(`📌 *Agenda de hoje:*`);
      for (const ev of events) {
        const hora = formatTimeBR(ev.inicio);
        const cliente = ev.clients?.nome ? ` (${ev.clients.nome})` : "";
        lines.push(`• ${hora} — ${ev.titulo}${cliente}`);
      }
      lines.push(``);
    }

    if (todayTasks.length > 0) {
      lines.push(`📋 *Tarefas pra hoje:*`);
      for (const t of todayTasks) {
        const cliente = t.clients?.nome ? ` (${t.clients.nome})` : "";
        lines.push(`• ${t.titulo}${cliente}`);
      }
      lines.push(``);
    }

    if (overdueTasks.length > 0) {
      lines.push(`⚠️ *${overdueTasks.length} tarefa(s) atrasada(s)*`);
      lines.push(``);
    }

    lines.push(`Bora! 💪`);

    const result = await sendWhatsAppMessage(assessor.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

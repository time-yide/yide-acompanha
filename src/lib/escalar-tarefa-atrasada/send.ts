import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { getTodayDate, formatDateBR } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendEscalarTarefaAtrasada(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const today = getTodayDate();

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const cutoff = threeDaysAgo.toISOString().split("T")[0];

  const { data: tasks } = await sb
    .from("tasks")
    .select("id, titulo, due_date, atribuido_a, client_id, clients(nome), profiles!tasks_atribuido_a_fkey(nome)")
    .lt("due_date", cutoff)
    .not("status", "in", '("concluida","aprovada","postada")')
    .not("due_date", "is", null)
    .is("deleted_at", null);

  if (!tasks || tasks.length === 0) return { sent: 0, skipped: 0 };

  interface TaskRow {
    id: string;
    titulo: string;
    due_date: string;
    atribuido_a: string;
    client_id: string | null;
    clients: { nome: string } | null;
    profiles: { nome: string } | null;
  }
  const rows = tasks as TaskRow[];

  const { data: admins } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("role", ["adm", "socio"])
    .eq("ativo", true)
    .not("telefone", "is", null);

  if (!admins || admins.length === 0) return { sent: 0, skipped: rows.length };

  const lines = [
    `🚨 *Tarefas atrasadas 3+ dias*`,
    ``,
    `Atenção! *${rows.length}* tarefa(s) estão atrasadas há mais de 3 dias:`,
    ``,
  ];

  for (const t of rows.slice(0, 15)) {
    const responsavel = t.profiles?.nome?.split(" ")[0] ?? "—";
    const cliente = t.clients?.nome ?? "";
    const dias = Math.floor((new Date(today).getTime() - new Date(t.due_date).getTime()) / 86400000);
    lines.push(`• *${t.titulo}*${cliente ? ` (${cliente})` : ""}`);
    lines.push(`  👤 ${responsavel} — atrasada ${dias} dias (era ${formatDateBR(t.due_date)})`);
  }

  if (rows.length > 15) {
    lines.push(`  … e mais ${rows.length - 15} tarefa(s)`);
  }

  lines.push(``);
  lines.push(`Verifique e tome providências! ⚡`);

  const msg = lines.join("\n");
  let sent = 0;
  let skipped = 0;

  interface Admin { id: string; nome: string; telefone: string | null }
  for (const adm of admins as Admin[]) {
    if (!adm.telefone) { skipped++; continue; }
    const result = await sendWhatsAppMessage(adm.telefone, msg);
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

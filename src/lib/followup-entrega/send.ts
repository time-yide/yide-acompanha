import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendFollowupEntrega(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoIso = twoDaysAgo.toISOString();

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const oneDayAgoIso = oneDayAgo.toISOString();

  const { data: tasks } = await sb
    .from("tasks")
    .select("id, titulo, tipo, client_id, clients(nome, grupo_wpp_jid, contato_principal)")
    .in("status", ["concluida", "aprovada", "postada"])
    .gte("completed_at", twoDaysAgoIso)
    .lt("completed_at", oneDayAgoIso)
    .not("client_id", "is", null);

  if (!tasks || tasks.length === 0) return { sent: 0, skipped: 0 };

  interface TaskRow {
    id: string;
    titulo: string;
    tipo: string | null;
    client_id: string;
    clients: { nome: string; grupo_wpp_jid: string | null; contato_principal: string | null } | null;
  }

  const byClient = new Map<string, TaskRow[]>();
  for (const t of tasks as TaskRow[]) {
    if (!t.clients?.grupo_wpp_jid) continue;
    const list = byClient.get(t.client_id) ?? [];
    list.push(t);
    byClient.set(t.client_id, list);
  }

  let sent = 0;
  let skipped = 0;

  for (const [, clientTasks] of byClient) {
    const client = clientTasks[0].clients!;
    const jid = client.grupo_wpp_jid!;

    const dedupKey = `followup-entrega-${clientTasks[0].client_id}-${clientTasks[0].id}`;
    const { data: existing } = await sb
      .from("cron_runs")
      .select("ran_at")
      .eq("job_name", dedupKey)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    await sb.from("cron_runs").insert({
      job_name: dedupKey,
      run_date: new Date().toISOString().split("T")[0],
    });

    const nome = client.contato_principal || client.nome;

    const lines = [
      `📬 *Entrega realizada!*`,
      ``,
      `Olá${nome ? `, *${nome}*` : ""}! Passando pra conferir se ficou tudo certinho com a(s) entrega(s) recente(s):`,
      ``,
    ];

    for (const t of clientTasks.slice(0, 5)) {
      lines.push(`• ${t.titulo}`);
    }

    lines.push(``);
    lines.push(`Qualquer ajuste ou dúvida, é só chamar aqui! 😊`);

    const result = await sendWhatsAppGroupMessage(jid, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

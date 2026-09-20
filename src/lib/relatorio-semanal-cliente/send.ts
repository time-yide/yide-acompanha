import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendRelatorioSemanalCliente(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, grupo_wpp_jid, contato_principal")
    .eq("status", "ativo")
    .not("grupo_wpp_jid", "is", null);

  let sent = 0;
  let skipped = 0;

  for (const client of clients ?? []) {
    if (!client.grupo_wpp_jid) {
      skipped++;
      continue;
    }

    const [postsRes, tasksRes, eventsRes] = await Promise.all([
      sb
        .from("social_media_posts")
        .select("id, status")
        .eq("client_id", client.id)
        .eq("status", "publicado")
        .gte("updated_at", weekAgoIso),
      sb
        .from("tasks")
        .select("id, status, tipo")
        .eq("client_id", client.id)
        .in("status", ["concluida", "aprovada", "postada"])
        .gte("updated_at", weekAgoIso),
      sb
        .from("calendar_events")
        .select("id, sub_calendar")
        .eq("client_id", client.id)
        .eq("sub_calendar", "videomakers")
        .gte("inicio", weekAgoIso)
        .is("deleted_at", null),
    ]);

    const postsPublicados = (postsRes.data ?? []).length;
    const tarefasConcluidas = (tasksRes.data ?? []).length;
    const gravacoesFeitas = (eventsRes.data ?? []).length;

    if (postsPublicados === 0 && tarefasConcluidas === 0 && gravacoesFeitas === 0) {
      skipped++;
      continue;
    }

    const nome = client.contato_principal || client.nome;

    const lines = [
      `📊 *Resumo da semana*`,
      ``,
      `Olá${nome ? `, *${nome}*` : ""}! Aqui vai o que rolou essa semana:`,
      ``,
    ];

    if (postsPublicados > 0) {
      lines.push(`📱 *${postsPublicados}* post(s) publicado(s)`);
    }
    if (tarefasConcluidas > 0) {
      lines.push(`✅ *${tarefasConcluidas}* tarefa(s) concluída(s)`);
    }
    if (gravacoesFeitas > 0) {
      lines.push(`🎬 *${gravacoesFeitas}* gravação(ões) realizada(s)`);
    }

    lines.push(``);
    lines.push(`Seguimos evoluindo juntos! 🚀💙`);

    const result = await sendWhatsAppGroupMessage(client.grupo_wpp_jid, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

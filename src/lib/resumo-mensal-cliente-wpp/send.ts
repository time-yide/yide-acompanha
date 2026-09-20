import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendResumoMensalClienteWpp(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const now = new Date();
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromIso = firstOfLastMonth.toISOString();
  const toIso = firstOfThisMonth.toISOString();

  const mesNome = firstOfLastMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, grupo_wpp_jid, contato_principal")
    .eq("status", "ativo")
    .not("grupo_wpp_jid", "is", null);

  let sent = 0;
  let skipped = 0;

  for (const client of clients ?? []) {
    if (!client.grupo_wpp_jid) { skipped++; continue; }

    const [postsRes, tasksRes, eventsRes, reunioesRes] = await Promise.all([
      sb
        .from("social_media_posts")
        .select("id")
        .eq("client_id", client.id)
        .eq("status", "publicado")
        .gte("publicado_em", fromIso)
        .lt("publicado_em", toIso),
      sb
        .from("tasks")
        .select("id")
        .eq("client_id", client.id)
        .in("status", ["concluida", "aprovada", "postada"])
        .gte("completed_at", fromIso)
        .lt("completed_at", toIso),
      sb
        .from("calendar_events")
        .select("id")
        .eq("client_id", client.id)
        .eq("sub_calendar", "videomakers")
        .gte("inicio", fromIso)
        .lt("inicio", toIso)
        .is("deleted_at", null),
      sb
        .from("calendar_events")
        .select("id")
        .eq("client_id", client.id)
        .eq("sub_calendar", "agencia")
        .gte("inicio", fromIso)
        .lt("inicio", toIso)
        .is("deleted_at", null),
    ]);

    const posts = (postsRes.data ?? []).length;
    const tarefas = (tasksRes.data ?? []).length;
    const gravacoes = (eventsRes.data ?? []).length;
    const reunioes = (reunioesRes.data ?? []).length;

    if (posts === 0 && tarefas === 0 && gravacoes === 0 && reunioes === 0) {
      skipped++;
      continue;
    }

    const nome = client.contato_principal || client.nome;

    const lines = [
      `📊 *Resumo do mês — ${mesNome}*`,
      ``,
      `Olá${nome ? `, *${nome}*` : ""}! Confira o que realizamos juntos no mês passado:`,
      ``,
    ];

    if (posts > 0) lines.push(`📱 *${posts}* post(s) publicado(s)`);
    if (tarefas > 0) lines.push(`✅ *${tarefas}* tarefa(s) concluída(s)`);
    if (gravacoes > 0) lines.push(`🎬 *${gravacoes}* gravação(ões)`);
    if (reunioes > 0) lines.push(`🤝 *${reunioes}* reunião(ões)`);

    lines.push(``);
    lines.push(`Vamos com tudo pro próximo mês! 🚀💙`);

    const result = await sendWhatsAppGroupMessage(client.grupo_wpp_jid, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${pluralForm}`;
}

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

    const [postsRes, eventsRes, meetingsRes] = await Promise.all([
      sb
        .from("social_media_posts")
        .select("id, titulo, platform")
        .eq("client_id", client.id)
        .eq("status", "publicado")
        .gte("updated_at", weekAgoIso)
        .order("updated_at", { ascending: false })
        .limit(10),
      sb
        .from("calendar_events")
        .select("id, titulo, sub_calendar")
        .eq("client_id", client.id)
        .eq("sub_calendar", "videomakers")
        .gte("inicio", weekAgoIso)
        .is("deleted_at", null),
      sb
        .from("calendar_events")
        .select("id, titulo, sub_calendar")
        .eq("client_id", client.id)
        .in("sub_calendar", ["reunioes", "meetings"])
        .gte("inicio", weekAgoIso)
        .is("deleted_at", null),
    ]);

    const posts = postsRes.data ?? [];
    const gravacoes = eventsRes.data ?? [];
    const reunioes = meetingsRes.data ?? [];

    if (posts.length === 0 && gravacoes.length === 0 && reunioes.length === 0) {
      skipped++;
      continue;
    }

    const nome = client.contato_principal || client.nome;

    const lines = [
      `*Resumo da semana*`,
      ``,
      `Oi${nome ? ` ${nome}` : ""}! Segue o que rolou essa semana:`,
      ``,
    ];

    if (posts.length > 0) {
      lines.push(`- ${plural(posts.length, "post publicado", "posts publicados")}`);
    }

    if (gravacoes.length > 0) {
      lines.push(`- ${plural(gravacoes.length, "gravação realizada", "gravações realizadas")}`);
    }

    if (reunioes.length > 0) {
      lines.push(`- ${plural(reunioes.length, "reunião realizada", "reuniões realizadas")}`);
    }

    lines.push(``);
    lines.push(`Qualquer dúvida é só chamar aqui!`);

    const result = await sendWhatsAppGroupMessage(client.grupo_wpp_jid, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

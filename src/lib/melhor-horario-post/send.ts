import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendMelhorHorarioPost(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, assessor_id")
    .eq("status", "ativo")
    .not("assessor_id", "is", null);

  if (!clients || clients.length === 0) return { sent: 0, skipped: 0 };

  interface ClientRow { id: string; nome: string; assessor_id: string }

  interface HorarioInfo {
    clienteNome: string;
    melhorHora: number;
    engajMedio: number;
    totalPosts: number;
  }

  const sugestoesByAssessor = new Map<string, HorarioInfo[]>();

  for (const client of clients as ClientRow[]) {
    const { data: posts } = await sb
      .from("social_media_posts")
      .select("id, publicado_em")
      .eq("client_id", client.id)
      .eq("status", "publicado")
      .not("publicado_em", "is", null);

    if (!posts || posts.length < 5) continue;

    interface PostRow { id: string; publicado_em: string }
    const postRows = posts as PostRow[];
    const postIds = postRows.map((p) => p.id);

    const { data: metricas } = await sb
      .from("social_media_metricas")
      .select("post_id, metrica, valor")
      .in("post_id", postIds)
      .in("metrica", ["curtidas", "comentarios", "salvamentos", "compartilhamentos"]);

    if (!metricas || metricas.length === 0) continue;

    interface MetricaRow { post_id: string; metrica: string; valor: number }
    const engajByPost = new Map<string, number>();
    for (const m of metricas as MetricaRow[]) {
      const cur = engajByPost.get(m.post_id) ?? 0;
      engajByPost.set(m.post_id, cur + Number(m.valor));
    }

    const engajByHour = new Map<number, { total: number; count: number }>();

    for (const post of postRows) {
      const eng = engajByPost.get(post.id);
      if (eng == null) continue;

      const date = new Date(post.publicado_em);
      const hour = date.getUTCHours() - 4;
      const localHour = hour < 0 ? hour + 24 : hour;

      const entry = engajByHour.get(localHour) ?? { total: 0, count: 0 };
      entry.total += eng;
      entry.count++;
      engajByHour.set(localHour, entry);
    }

    if (engajByHour.size < 2) continue;

    let bestHour = 0;
    let bestAvg = 0;
    for (const [hour, data] of engajByHour) {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestHour = hour;
      }
    }

    const list = sugestoesByAssessor.get(client.assessor_id) ?? [];
    list.push({
      clienteNome: client.nome,
      melhorHora: bestHour,
      engajMedio: Math.round(bestAvg),
      totalPosts: postRows.length,
    });
    sugestoesByAssessor.set(client.assessor_id, list);
  }

  if (sugestoesByAssessor.size === 0) return { sent: 0, skipped: 0 };

  const assessorIds = [...sugestoesByAssessor.keys()];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", assessorIds);

  interface Profile { id: string; nome: string; telefone: string | null }
  const profileMap = new Map<string, Profile>();
  for (const p of (profiles ?? []) as Profile[]) {
    profileMap.set(p.id, p);
  }

  let sent = 0;
  let skipped = 0;

  for (const [assessorId, sugestoes] of sugestoesByAssessor) {
    const profile = profileMap.get(assessorId);
    if (!profile?.telefone) { skipped++; continue; }

    const lines = [
      `⏰ *Melhor horário de publicação*`,
      ``,
      `${profile.nome?.split(" ")[0] ?? ""}, baseado nas métricas dos seus clientes:`,
      ``,
    ];

    for (const s of sugestoes.slice(0, 10)) {
      const hora = `${String(s.melhorHora).padStart(2, "0")}:00`;
      lines.push(`📱 *${s.clienteNome}* → postar às *${hora}*`);
      lines.push(`   📊 Engajamento médio: ${s.engajMedio} (${s.totalPosts} posts analisados)`);
    }

    lines.push(``);
    lines.push(`Use como referência ao agendar os próximos posts! 📅`);

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

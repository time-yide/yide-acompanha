import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendPostViralizouAlerta(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString();

  const { data: recentPosts } = await sb
    .from("social_media_posts")
    .select("id, client_id, legenda, status, publicado_em, clients(nome, assessor_id)")
    .eq("status", "publicado")
    .gte("publicado_em", cutoff)
    .not("publicado_em", "is", null);

  if (!recentPosts || recentPosts.length === 0) return { sent: 0, skipped: 0 };

  interface PostRow {
    id: string;
    client_id: string;
    legenda: string | null;
    status: string;
    publicado_em: string;
    clients: { nome: string; assessor_id: string | null } | null;
  }

  const posts = recentPosts as PostRow[];
  const clientIds = [...new Set(posts.map((p) => p.client_id))];

  const { data: allMetrics } = await sb
    .from("social_media_metricas")
    .select("post_id, metrica, valor")
    .in("metrica", ["curtidas", "comentarios", "salvamentos", "compartilhamentos"]);

  if (!allMetrics || allMetrics.length === 0) return { sent: 0, skipped: 0 };

  interface MetricRow { post_id: string; metrica: string; valor: number }
  const metrics = allMetrics as MetricRow[];

  const engajByPost = new Map<string, number>();
  for (const m of metrics) {
    const cur = engajByPost.get(m.post_id) ?? 0;
    engajByPost.set(m.post_id, cur + Number(m.valor));
  }

  const { data: allClientPosts } = await sb
    .from("social_media_posts")
    .select("id, client_id")
    .eq("status", "publicado")
    .in("client_id", clientIds);

  interface SimplePost { id: string; client_id: string }
  const avgByClient = new Map<string, number>();
  const postsByClient = new Map<string, string[]>();

  for (const p of (allClientPosts ?? []) as SimplePost[]) {
    const list = postsByClient.get(p.client_id) ?? [];
    list.push(p.id);
    postsByClient.set(p.client_id, list);
  }

  for (const [clientId, postIds] of postsByClient) {
    let total = 0;
    let count = 0;
    for (const pid of postIds) {
      const eng = engajByPost.get(pid);
      if (eng != null) {
        total += eng;
        count++;
      }
    }
    if (count > 0) avgByClient.set(clientId, total / count);
  }

  interface ViralPost {
    clienteNome: string;
    legenda: string;
    engajamento: number;
    media: number;
    multiplicador: number;
  }

  const viralByAssessor = new Map<string, ViralPost[]>();

  for (const post of posts) {
    const assessorId = post.clients?.assessor_id;
    if (!assessorId) continue;

    const eng = engajByPost.get(post.id);
    if (eng == null || eng === 0) continue;

    const avg = avgByClient.get(post.client_id);
    if (!avg || avg === 0) continue;

    const mult = eng / avg;
    if (mult < 2) continue;

    const list = viralByAssessor.get(assessorId) ?? [];
    list.push({
      clienteNome: post.clients?.nome ?? "Cliente",
      legenda: post.legenda
        ? post.legenda.length > 50 ? post.legenda.slice(0, 50) + "…" : post.legenda
        : "(sem legenda)",
      engajamento: eng,
      media: Math.round(avg),
      multiplicador: Math.round(mult * 10) / 10,
    });
    viralByAssessor.set(assessorId, list);
  }

  if (viralByAssessor.size === 0) return { sent: 0, skipped: 0 };

  const assessorIds = [...viralByAssessor.keys()];
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

  for (const [assessorId, virals] of viralByAssessor) {
    const profile = profileMap.get(assessorId);
    if (!profile?.telefone) { skipped++; continue; }

    const lines = [
      `🔥 *Post viralizou!*`,
      ``,
      `${profile.nome?.split(" ")[0] ?? ""}, esses posts tiveram engajamento muito acima da média:`,
      ``,
    ];

    for (const v of virals.slice(0, 5)) {
      lines.push(`🚀 *${v.clienteNome}* — *${v.multiplicador}x* a média!`);
      lines.push(`   📊 Engajamento: ${v.engajamento} (média: ${v.media})`);
      lines.push(`   📝 ${v.legenda}`);
      lines.push(``);
    }

    lines.push(`Considere replicar o formato! 💡`);

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

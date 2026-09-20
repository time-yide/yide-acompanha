import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { gerarLegenda } from "@/lib/social-media/caption-generator";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendAutoLegendaIA(): Promise<{
  generated: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: posts } = await sb
    .from("social_media_posts")
    .select("id, titulo, client_id, formato, redes, legenda, hashtags, clients(nome, assessor_id, design_style_guide, servico)")
    .eq("status", "rascunho")
    .is("legenda", null)
    .not("titulo", "is", null)
    .limit(20);

  if (!posts || posts.length === 0) return { generated: 0, skipped: 0 };

  interface PostRow {
    id: string;
    titulo: string;
    client_id: string;
    formato: string;
    redes: string[];
    legenda: string | null;
    hashtags: string | null;
    clients: {
      nome: string;
      assessor_id: string | null;
      design_style_guide: { tom_voz?: string; mood?: string; evitar?: string } | null;
      servico: string | null;
    } | null;
  }

  let generated = 0;
  let skipped = 0;

  const generatedByAssessor = new Map<string, string[]>();

  for (const post of posts as PostRow[]) {
    const style = post.clients?.design_style_guide;

    const result = await gerarLegenda({
      clientNome: post.clients?.nome ?? "Cliente",
      servico: post.clients?.servico ?? null,
      tomVoz: style?.tom_voz ?? null,
      mood: style?.mood ?? null,
      evitar: style?.evitar ?? null,
      formato: post.formato ?? "feed",
      redes: post.redes ?? ["instagram"],
      brief: post.titulo,
      rascunho: null,
    });

    if ("error" in result) { skipped++; continue; }

    const updateData: Record<string, string> = { legenda: result.legenda };
    if (!post.hashtags && result.hashtags) {
      updateData.hashtags = result.hashtags;
    }

    await sb
      .from("social_media_posts")
      .update(updateData)
      .eq("id", post.id);

    generated++;

    const assessorId = post.clients?.assessor_id;
    if (assessorId) {
      const list = generatedByAssessor.get(assessorId) ?? [];
      list.push(`${post.clients?.nome ?? "Cliente"} — "${post.titulo}"`);
      generatedByAssessor.set(assessorId, list);
    }
  }

  if (generatedByAssessor.size > 0) {
    const assessorIds = [...generatedByAssessor.keys()];
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, nome, telefone")
      .in("id", assessorIds);

    interface Profile { id: string; nome: string; telefone: string | null }
    for (const prof of (profiles ?? []) as Profile[]) {
      if (!prof.telefone) continue;
      const items = generatedByAssessor.get(prof.id);
      if (!items || items.length === 0) continue;

      const lines = [
        `✍️ *Legendas geradas pela IA*`,
        ``,
        `${prof.nome?.split(" ")[0] ?? ""}, gerei legendas pra ${items.length} post(s):`,
        ``,
      ];
      for (const item of items.slice(0, 5)) {
        lines.push(`• ${item}`);
      }
      lines.push(``);
      lines.push(`Revise e ajuste antes de publicar! 📝`);

      await sendWhatsAppMessage(prof.telefone, lines.join("\n"));
    }
  }

  return { generated, skipped };
}

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient, SATISFACTION_MODEL } from "@/lib/ai/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendAutoHashtagsIA(): Promise<{
  generated: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const ai = getAnthropicClient();
  if (!ai) return { generated: 0, skipped: 0 };

  const { data: posts } = await sb
    .from("social_media_posts")
    .select("id, legenda, formato, client_id, clients(nome, servico)")
    .in("status", ["rascunho", "aguardando_aprovacao", "aprovado", "agendado"])
    .not("legenda", "is", null)
    .is("hashtags", null)
    .limit(20);

  if (!posts || posts.length === 0) return { generated: 0, skipped: 0 };

  interface PostRow {
    id: string;
    legenda: string;
    formato: string;
    client_id: string;
    clients: { nome: string; servico: string | null } | null;
  }

  let generated = 0;
  let skipped = 0;

  for (const post of posts as PostRow[]) {
    if (!post.legenda?.trim()) { skipped++; continue; }

    try {
      const response = await ai.messages.create({
        model: SATISFACTION_MODEL,
        max_tokens: 200,
        system: [
          {
            type: "text",
            text: `Você gera hashtags para posts de social media. Retorne APENAS as hashtags numa linha, sem JSON, sem explicação. Entre 8 e 15 hashtags relevantes. Misture hashtags amplas e de nicho. Português do Brasil.`,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Cliente: ${post.clients?.nome ?? "Cliente"}\nServiço: ${post.clients?.servico ?? "não informado"}\nFormato: ${post.formato}\n\nLegenda:\n${post.legenda}\n\nGere as hashtags:`,
          },
        ],
      });

      const raw = response.content[0];
      if (!raw || raw.type !== "text" || !raw.text?.trim()) { skipped++; continue; }

      const hashtags = raw.text.trim();

      await sb
        .from("social_media_posts")
        .update({ hashtags })
        .eq("id", post.id);

      generated++;
    } catch {
      skipped++;
    }
  }

  return { generated, skipped };
}

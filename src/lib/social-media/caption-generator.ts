// SERVER ONLY: do not import from client components
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";

const CAPTION_MODEL = "claude-haiku-4-5";
const CAPTION_MAX_TOKENS = 800;

export interface CaptionContext {
  clientNome: string;
  servico: string | null;
  tomVoz: string | null;
  mood: string | null;
  evitar: string | null;
  formato: string; // feed | carrossel | story | reels
  redes: string[]; // ["instagram", "facebook", ...]
  brief: string | null; // ideia do post (modo gerar)
  rascunho: string | null; // legenda atual (modo melhorar)
}

export const captionOutputSchema = z.object({
  legenda: z.string(),
  hashtags: z.string(),
});

export type CaptionResult =
  | { legenda: string; hashtags: string }
  | { error: string };

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      (block as { type: string }).type === "text"
    ) {
      const text = (block as { text?: string }).text;
      if (typeof text === "string") return text;
    }
  }
  return "";
}

function cleanJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildSystemPrompt(ctx: CaptionContext): string {
  return `Você é redator(a) de social media da agência Yide Digital, especialista em legendas que engajam.

Cliente: ${ctx.clientNome}
Serviço: ${ctx.servico ?? "não informado"}
Tom de voz da marca: ${ctx.tomVoz?.trim() ? ctx.tomVoz : "profissional, claro e próximo"}
Mood/estilo: ${ctx.mood?.trim() ? ctx.mood : "não informado"}
Evitar: ${ctx.evitar?.trim() ? ctx.evitar : "nada específico"}

Regras:
- Escreva SEMPRE na voz da marca acima.
- Não invente dados, preços, datas ou promessas que não foram passados.
- Ajuste o tamanho ao formato: story/reels = curto e direto; feed/carrossel = pode desenvolver mais.
- Hashtags relevantes ao segmento (misture amplas e de nicho), entre 8 e 15.
- Português do Brasil.`;
}

function buildUserPrompt(ctx: CaptionContext): string {
  const tarefa = ctx.rascunho?.trim()
    ? `Melhore o rascunho de legenda abaixo, deixando mais envolvente e fiel à voz da marca (mantenha a intenção):\n\n"""${ctx.rascunho.trim()}"""`
    : `Crie a legenda para este post a partir da ideia:\n\n"""${(ctx.brief ?? "").trim()}"""`;

  return `${tarefa}

Formato do post: ${ctx.formato}
Redes: ${ctx.redes.join(", ") || "instagram"}

Responda APENAS com um JSON válido, sem texto antes ou depois:
{
  "legenda": "a legenda pronta (sem as hashtags)",
  "hashtags": "as hashtags numa única linha, ex: #marketing #cuiaba #promocao"
}`;
}

export async function gerarLegenda(ctx: CaptionContext): Promise<CaptionResult> {
  const client = getAnthropicClient();
  if (!client) {
    return { error: "IA não configurada (sem ANTHROPIC_API_KEY)" };
  }
  if (!ctx.rascunho?.trim() && !ctx.brief?.trim()) {
    return { error: "Escreva uma ideia pra IA gerar (ou um rascunho pra melhorar)" };
  }

  try {
    const response = await client.messages.create({
      model: CAPTION_MODEL,
      max_tokens: CAPTION_MAX_TOKENS,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(ctx),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    });

    const raw = extractText(response.content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson(raw));
    } catch {
      return { error: "Não consegui gerar agora, tente de novo" };
    }
    const validated = captionOutputSchema.safeParse(parsed);
    if (!validated.success) {
      return { error: "Não consegui gerar agora, tente de novo" };
    }
    return { legenda: validated.data.legenda, hashtags: validated.data.hashtags };
  } catch (err) {
    console.error("[caption-generator] AI call failed:", err instanceof Error ? err.message : err);
    return { error: "Erro ao chamar a IA, tente de novo" };
  }
}

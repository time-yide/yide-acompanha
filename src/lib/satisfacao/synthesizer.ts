// SERVER ONLY: do not import from client components
import { getAnthropicClient, SATISFACTION_MODEL, MAX_TOKENS } from "@/lib/ai/client";
import { synthesisOutputSchema, type SynthesisInput, type SynthesisOutput } from "./schema";

function buildSystemPrompt(input: SynthesisInput): string {
  const monthsCount = monthsBetween(input.client.data_entrada, new Date());
  const historyText = input.history_4_weeks.length === 0
    ? "(sem histórico anterior)"
    : input.history_4_weeks
        .map((h) => `- ${h.semana_iso}: ${h.cor_final} — ${h.resumo_ia}`)
        .join("\n");
  return `Você é um analista de satisfação de clientes da Yide Digital.

Cliente: ${input.client.nome}
Valor mensal: R$ ${input.client.valor_mensal}
Tempo de casa: ${monthsCount} meses (entrou em ${input.client.data_entrada})
Serviço contratado: ${input.client.servico_contratado ?? "não informado"}

Histórico das últimas 4 semanas (mais recente primeiro):
${historyText}`;
}

function buildUserPrompt(input: SynthesisInput): string {
  const entriesText = input.current_entries
    .map((e) => `${e.papel}: ${e.cor}${e.comentario ? " - " + e.comentario : ""}`)
    .join("\n");
  return `Avaliações desta semana (${input.current_week_iso}):
${entriesText}

Sintetize a satisfação desta semana em JSON:
{
  "score_final": número 0-10,
  "cor_final": "verde" | "amarelo" | "vermelho",
  "resumo_ia": "1-2 parágrafos analisando a semana e tendência",
  "divergencia_detectada": true se coord e assessor deram cores diferentes,
  "acao_sugerida": null se cor_final=verde; texto curto sugerindo ação se amarelo/vermelho
}

Regras:
- Score 0-3 = vermelho, 4-7 = amarelo, 8-10 = verde
- Se só tem 1 avaliação (a outra falhou), divergencia_detectada=false, score baseado nela
- Resumo deve referenciar contexto histórico se houver tendência (ex: "3ª semana seguida em vermelho — ação urgente")
- Tom profissional, direto, em português

Retorne APENAS o JSON, sem texto antes ou depois.`;
}

function monthsBetween(isoStart: string, end: Date): number {
  const start = new Date(isoStart);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (block && typeof block === "object" && "type" in block && (block as { type: string }).type === "text") {
      const text = (block as { text?: string }).text;
      if (typeof text === "string") return text;
    }
  }
  return "";
}

export async function synthesizeClientSatisfaction(
  input: SynthesisInput,
): Promise<SynthesisOutput | null> {
  const client = getAnthropicClient();
  if (!client) {
    console.warn("[synthesizer] ANTHROPIC_API_KEY not configured; skipping synthesis");
    return null;
  }

  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await client.messages.create({
      model: SATISFACTION_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = extractText(response.content);
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[synthesizer] failed to parse AI JSON response:", rawText.slice(0, 200));
      return null;
    }

    const validated = synthesisOutputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[synthesizer] AI response failed schema validation:", validated.error.issues);
      return null;
    }

    const tokens = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    return {
      score_final: validated.data.score_final,
      cor_final: validated.data.cor_final,
      resumo_ia: validated.data.resumo_ia,
      divergencia_detectada: validated.data.divergencia_detectada,
      acao_sugerida: validated.data.acao_sugerida ?? null,
      ai_tokens_used: tokens,
    };
  } catch (err) {
    console.error("[synthesizer] AI call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// SERVER ONLY — Claude limpa pontuação e capitalização da transcrição.

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";
import type { WhisperWord } from "../tipos";

export interface CleanupResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  words: WhisperWord[];
}

const EMPTY: CleanupResult = {
  ok: false,
  skipped: false,
  error: null,
  words: [],
};

export function parseCleanupResponse(raw: string): CleanupResult {
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) {
    return { ...EMPTY, error: "Resposta sem JSON array" };
  }

  try {
    const parsed = JSON.parse(match[0]) as Array<{ word: string; start: number; end: number }>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { ...EMPTY, error: "Array vazio" };
    }
    const words: WhisperWord[] = parsed
      .filter((w) => typeof w?.word === "string" && typeof w?.start === "number" && typeof w?.end === "number")
      .map((w) => ({ word: w.word, start: w.start, end: w.end }));
    if (words.length === 0) {
      return { ...EMPTY, error: "Nenhuma palavra válida" };
    }
    return { ok: true, skipped: false, error: null, words };
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : "JSON parse error" };
  }
}

export async function cleanupTranscription(words: WhisperWord[]): Promise<CleanupResult> {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: true, skipped: true, error: null, words };
  }
  if (words.length === 0) {
    return { ...EMPTY, error: "Nenhuma palavra pra limpar" };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const userMsg = `Recebi uma transcrição automática em português brasileiro com timestamps por palavra. Limpe pontuação e capitalização (vírgulas, pontos finais, ?, !, primeiras letras maiúsculas após ponto).

REGRAS:
1. Não mude o conteúdo das palavras — só ajuste pontuação/capitalização.
2. NÃO mude os timestamps (start/end). Preserve exatos.
3. Mantenha o mesmo número de itens no array.
4. Responda APENAS com o JSON array. Sem texto adicional.

Transcrição:
${JSON.stringify(words)}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = response.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    return parseCleanupResponse(text);
  } catch (err) {
    console.warn("[claude-cleanup] falhou:", err instanceof Error ? err.message : err);
    return { ok: true, skipped: false, error: null, words };
  }
}

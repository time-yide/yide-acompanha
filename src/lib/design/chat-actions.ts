"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/session";
import { getManualMarca } from "./queries";
import { buildStudioSystemPrompt } from "./studio-prompt";
import { parseRespostaIA, type Comando } from "./studio-comandos";
import type { Composicao } from "./studio-tipos";

export interface ChatMsg { role: "user" | "assistant"; content: string }

interface ChatErr { error: string }
type ChatResult = { mensagem: string; comandos: Comando[] } | ChatErr;

const ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

/** Pure: monta o array de mensagens da Anthropic a partir do histórico + nova msg. */
export function montarMensagensChat(historico: ChatMsg[], nova: string): ChatMsg[] {
  const limpo = historico.filter((m) => m.role === "user" || m.role === "assistant");
  return [...limpo, { role: "user", content: nova }];
}

export async function chatStudioAction(
  clientId: string,
  historico: ChatMsg[],
  mensagem: string,
  composicao: Composicao,
): Promise<ChatResult> {
  const actor = await requireAuth();
  if (!ROLES.includes(actor.role)) return { error: "Sem permissão" };

  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return { error: "IA não configurada (ANTHROPIC_API_KEY ausente)" };

  const manual = await getManualMarca(clientId);
  const system = buildStudioSystemPrompt(manual, composicao);
  const messages = montarMensagensChat(historico, mensagem);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system,
      messages,
    });
    const raw = resp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const { mensagem: msg, comandos } = parseRespostaIA(raw);
    return { mensagem: msg || "Pronto!", comandos };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao chamar a IA" };
  }
}

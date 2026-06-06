"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/session";
import { isDesignRole } from "./roles";
import { getManualMarca } from "./queries";
import { buildStudioSystemPrompt } from "./studio-prompt";
import { parseRespostaIA, type Comando } from "./studio-comandos";
import type { Composicao } from "./studio-tipos";
import { montarMensagensChat, type ChatMsg } from "./chat-utils";

export type { ChatMsg } from "./chat-utils";

interface ChatErr { error: string }
type ChatResult = { mensagem: string; comandos: Comando[] } | ChatErr;

export async function chatStudioAction(
  clientId: string,
  historico: ChatMsg[],
  mensagem: string,
  composicao: Composicao,
): Promise<ChatResult> {
  const actor = await requireAuth();
  // m1: use shared isDesignRole
  if (!isDesignRole(actor.role)) return { error: "Sem permissão" };

  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return { error: "IA não configurada (ANTHROPIC_API_KEY ausente)" };

  const manual = await getManualMarca(clientId);
  const system = buildStudioSystemPrompt(manual, composicao);
  // m3: cap history to the last 10 turns to avoid unbounded context growth
  const messages = montarMensagensChat(historico.slice(-10), mensagem);

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

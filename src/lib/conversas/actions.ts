"use server";

import { requireAuth } from "@/lib/auth/session";
import { enviarMensagemLyide, type EnvioResultado } from "./lyide";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor", "programacao"];

/** Responde uma conversa do número da API da agência, pelo Lyide. */
export async function responderConversaAction(conversationId: string, texto: string): Promise<EnvioResultado> {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) return { ok: false, erro: "Sem acesso para responder." };
  const limpo = texto.trim();
  if (!conversationId || !limpo) return { ok: false, erro: "Escreva a mensagem." };
  if (limpo.length > 4000) return { ok: false, erro: "Mensagem muito longa (até 4000 caracteres)." };
  return enviarMensagemLyide(conversationId, limpo, user.email ?? null);
}

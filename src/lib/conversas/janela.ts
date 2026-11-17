import type { WppMessage } from "./types";

const H = 3_600_000;

/**
 * Janela de 24h da API Oficial do WhatsApp: texto livre só sai até 24h depois
 * da última mensagem do cliente. Sem mensagem do cliente nas mensagens
 * carregadas = fechada (o Lyide confere de novo antes de enviar).
 */
export function janelaFechada(mensagens: Pick<WppMessage, "autor" | "created_at">[], agora: Date = new Date()): boolean {
  let ultima = 0;
  for (const m of mensagens) {
    if (m.autor !== "lead") continue;
    const t = Date.parse(m.created_at);
    if (Number.isFinite(t) && t > ultima) ultima = t;
  }
  if (!ultima) return true;
  return agora.getTime() - ultima > 24 * H;
}

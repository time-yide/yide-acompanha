// SERVER ONLY
import "server-only";
import type { AutorMensagem, StatusMensagem, WppConversation, WppMessage } from "./types";

/**
 * Espelho das conversas do número da API (WhatsApp) da conta da agência no
 * Lyide. Lê da API externa do Lyide (/api/external/conversas), protegida por
 * Bearer. Responde com texto pelo POST da mesma API (modelo e mídia: no Lyide).
 *
 * Env: LYIDE_API_URL (ex.: https://app.lyide.com.br) e LYIDE_API_SECRET
 * (mesmo valor de ACOMPANHA_API_SECRET no Lyide).
 */

export interface LyideConversaApi {
  id: string;
  leadId: string;
  nome: string;
  telefone: string | null;
  avatarUrl: string | null;
  grupo: boolean;
  aiPausada: boolean;
  ultimaMsgEm: string;
  ultimoTexto: string | null;
  ultimaDirecao: "IN" | "OUT" | null;
}

export interface LyideMensagemApi {
  id: string;
  direcao: "IN" | "OUT";
  autor: "cliente" | "atendente" | "ia";
  texto: string;
  tipo: string;
  status: string;
  remetente: string | null;
  criadaEm: string;
}

export type LyideResultado<T> = { ok: true; data: T } | { ok: false; erro: "nao_configurado" | "falha" };

function config(): { url: string; secret: string } | null {
  const url = process.env.LYIDE_API_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.LYIDE_API_SECRET?.trim();
  if (!url || !secret) return null;
  return { url, secret };
}

/** Link da conversa no Lyide (abre o chat do lead). */
export function lyideChatUrl(leadId: string): string | null {
  const cfg = config();
  return cfg ? `${cfg.url}/leads/${encodeURIComponent(leadId)}` : null;
}

async function get<T>(path: string): Promise<LyideResultado<T>> {
  const cfg = config();
  if (!cfg) return { ok: false, erro: "nao_configurado" };
  try {
    const r = await fetch(`${cfg.url}${path}`, {
      headers: { authorization: `Bearer ${cfg.secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      console.error(`[conversas/lyide] GET ${path} -> ${r.status}`);
      return { ok: false, erro: "falha" };
    }
    return { ok: true, data: (await r.json()) as T };
  } catch (e) {
    console.error(`[conversas/lyide] GET ${path} falhou:`, e instanceof Error ? e.message : e);
    return { ok: false, erro: "falha" };
  }
}

const STATUS: Record<string, StatusMensagem> = {
  PENDING: "enviando",
  SENT: "enviada",
  DELIVERED: "entregue",
  READ: "lida",
  PLAYED: "lida",
  FAILED: "falhou",
};

const AUTOR: Record<LyideMensagemApi["autor"], AutorMensagem> = {
  cliente: "lead",
  atendente: "comercial",
  ia: "ia",
};

export function mapConversa(c: LyideConversaApi): WppConversation {
  return {
    id: c.id,
    organization_id: "",
    contato_nome: c.nome,
    contato_telefone: c.telefone ?? "",
    canal: "whatsapp",
    lead_gerado_id: null,
    lead_nome: null,
    ultimo_texto: c.ultimoTexto,
    ultima_msg_em: c.ultimaMsgEm,
    // Lyide não expõe "não lidas": última mensagem do cliente = aguardando resposta.
    nao_lidas: c.ultimaDirecao === "IN" ? 1 : 0,
    arquivada: false,
    fixada: false,
    twilio_from: null,
    ai_ativa: !c.aiPausada,
    ai_config_id: null,
    created_at: c.ultimaMsgEm,
    updated_at: c.ultimaMsgEm,
    avatar_url: c.avatarUrl,
    lyide_url: lyideChatUrl(c.leadId),
  };
}

export function mapMensagem(conversationId: string, m: LyideMensagemApi): WppMessage {
  return {
    id: m.id,
    conversation_id: conversationId,
    autor: AUTOR[m.autor] ?? "lead",
    texto: m.remetente && m.direcao === "IN" ? `${m.remetente}: ${m.texto}` : m.texto,
    media_url: null,
    media_type: null,
    twilio_sid: null,
    status: STATUS[m.status] ?? "enviada",
    enviado_por: null,
    created_at: m.criadaEm,
  };
}

export async function listarConversasLyide(): Promise<
  LyideResultado<{ conexao: { nome: string; status: string } | null; conversas: WppConversation[] }>
> {
  const r = await get<{ conexao?: { nome: string; status: string }; conversas: LyideConversaApi[] }>(
    "/api/external/conversas",
  );
  if (!r.ok) return r;
  return {
    ok: true,
    data: { conexao: r.data.conexao ?? null, conversas: (r.data.conversas ?? []).map(mapConversa) },
  };
}

export async function listarMensagensLyide(conversationId: string): Promise<LyideResultado<WppMessage[]>> {
  const r = await get<{ mensagens: LyideMensagemApi[] }>(
    `/api/external/conversas/${encodeURIComponent(conversationId)}/mensagens`,
  );
  if (!r.ok) return r;
  return { ok: true, data: (r.data.mensagens ?? []).map((m) => mapMensagem(conversationId, m)) };
}

export type EnvioResultado = { ok: true } | { ok: false; erro: string; janelaFechada?: boolean };

/**
 * Responde com texto uma conversa pelo Lyide (mesmo fluxo do chat do Lyide).
 * autorEmail: quem está logado aqui; se for usuário da empresa no Lyide, a
 * mensagem sai no nome dele.
 */
export async function enviarMensagemLyide(
  conversationId: string,
  texto: string,
  autorEmail: string | null,
): Promise<EnvioResultado> {
  const cfg = config();
  if (!cfg) return { ok: false, erro: "Conversas ainda não conectadas ao Lyide." };
  const path = `/api/external/conversas/${encodeURIComponent(conversationId)}/mensagens`;
  try {
    const r = await fetch(`${cfg.url}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.secret}`, "content-type": "application/json" },
      body: JSON.stringify({ texto, autorEmail }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (r.ok) return { ok: true };
    const body = (await r.json().catch(() => null)) as { error?: string; janelaFechada?: boolean } | null;
    console.error(`[conversas/lyide] POST ${path} -> ${r.status}`, body?.error);
    if (r.status === 401 || r.status === 503) return { ok: false, erro: "Conexão com o Lyide não autorizada." };
    return {
      ok: false,
      erro: body?.error || "Não foi possível enviar agora. Tente de novo.",
      ...(body?.janelaFechada ? { janelaFechada: true } : {}),
    };
  } catch (e) {
    console.error(`[conversas/lyide] POST ${path} falhou:`, e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível falar com o Lyide agora. Tente de novo." };
  }
}

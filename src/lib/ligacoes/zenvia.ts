// SERVER ONLY - cliente da API de voz Zenvia (ex-TotalVoice).
import { getServerEnv } from "@/lib/env";
import type { StatusLigacao } from "./tipos";

const BASE = "https://voice-api.zenvia.com";

function token(): string | null {
  const t = getServerEnv().ZENVIA_VOICE_TOKEN;
  return t && t.trim() ? t.trim() : null;
}

/** Mapeia o status textual da Zenvia pro enum interno. */
export function mapStatusZenvia(statusZenvia: string, duracaoFaladaSegundos: number): StatusLigacao {
  const s = (statusZenvia || "").toLowerCase();
  if (s.includes("ocupad")) return "ocupada";
  if (s.includes("caixa")) return "caixa_postal";
  if (s.includes("cancel") || s.includes("falha") || s.includes("erro")) return "cancelada";
  if (s.includes("nao_atendida") || s.includes("não") || s.includes("sem_resposta") || s.includes("nao atendid")) return "perdida";
  if (s.includes("atendida")) return duracaoFaladaSegundos < 5 ? "rejeitada" : "atendida";
  return "perdida";
}

/** Monta a URL do webhook que a usuária cola no painel da Zenvia. */
export function buildWebhookUrl(appUrl: string, webhookSecret: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/ligacoes/zenvia?secret=${webhookSecret}`;
}

export interface IniciarChamadaArgs {
  numeroOrigem: string;
  numeroDestino: string;
  gravar: boolean;
  tags?: string;
}

export interface IniciarChamadaResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

/** POST /chamada - inicia a ligação. No-op tratável quando token ausente. */
export async function iniciarChamada(args: IniciarChamadaArgs): Promise<IniciarChamadaResult> {
  const t = token();
  if (!t) return { ok: false, error: "Zenvia não configurada (ZENVIA_VOICE_TOKEN ausente)" };
  try {
    const res = await fetch(`${BASE}/chamada`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": t },
      body: JSON.stringify({
        numero_origem: args.numeroOrigem,
        numero_destino: args.numeroDestino,
        gravar_audio: args.gravar,
        tags: args.tags,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: `Zenvia ${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
    }
    const dados = (data.dados as Record<string, unknown> | undefined) ?? data;
    const externalId = (dados.id ?? dados.chamada_id ?? data.id) as string | number | undefined;
    return { ok: true, externalId: externalId != null ? String(externalId) : undefined };
  } catch (e) {
    return { ok: false, error: `Falha ao chamar Zenvia: ${(e as Error).message}` };
  }
}

/** GET /webphone - retorna a URL do webphone pré-configurada pro ramal. */
export async function getWebphoneUrl(ramal: string): Promise<string | null> {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(`${BASE}/webphone?ramal=${encodeURIComponent(ramal)}`, {
      headers: { "Access-Token": t },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const dados = (data.dados as Record<string, unknown> | undefined) ?? data;
    const url = (dados.url ?? dados.webphone_url ?? data.url) as string | undefined;
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}

export interface EventoWebhookParsed {
  externalId: string;
  statusInterno: StatusLigacao;
  duracaoSegundos: number;
  gravacaoUrl: string | null;
  raw: Record<string, unknown>;
}

/** Extrai e normaliza um evento de fim/atualização de chamada da Zenvia. */
export function parseEventoWebhook(payload: Record<string, unknown>): EventoWebhookParsed {
  const externalId = String(payload.id ?? payload.chamada_id ?? "");
  const statusZenvia = String(payload.status ?? "");
  const duracaoSegundos = Number(payload.duracao_segundos ?? 0) || 0;
  const duracaoFalada = Number(payload.duracao_falada_segundos ?? duracaoSegundos) || 0;
  const gravacaoUrl = (payload.url_gravacao as string | undefined) ?? null;
  return {
    externalId,
    statusInterno: mapStatusZenvia(statusZenvia, duracaoFalada),
    duracaoSegundos,
    gravacaoUrl: typeof gravacaoUrl === "string" ? gravacaoUrl : null,
    raw: payload,
  };
}

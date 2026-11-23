// SERVER ONLY
import "server-only";
import { getGoogleToken, SCOPES_ADMIN } from "./google-auth";

/**
 * Escritas no Google com a conta de serviço (yide-dados): criar propriedade GA4 na conta
 * da Yide e verificar o domínio do cliente no Search Console via TXT de DNS.
 * Nunca lança: devolve { ok: false, erro } com mensagem pronta pra mostrar.
 */
export type ResultadoAdmin<T> = ({ ok: true } & T) | { ok: false; erro: string };

const GA4_ACCOUNT_PADRAO = "415402377";
const ERRO_GENERICO = "Não deu pra falar com o Google agora. Tente de novo em alguns minutos.";
const ERRO_CONFIG = "Conta de serviço do Google não configurada (GOOGLE_SERVICE_ACCOUNT_JSON).";
const ERRO_API_DESLIGADA = "Ative a Site Verification API no projeto do Google Cloud";
const ERRO_TXT_AUSENTE = "O registro TXT ainda não apareceu no DNS. Pode levar algumas horas depois que o cliente adicionar.";

type ErroGoogle = { status: number; code?: number; gstatus?: string; message: string };
type Resposta<T> = { ok: true; json: T } | { ok: false; erro: ErroGoogle } | { ok: false; semToken: true } | { ok: false; rede: true };

async function chamar<T>(metodo: "POST" | "PUT", url: string, body?: unknown): Promise<Resposta<T>> {
  const token = await getGoogleToken(SCOPES_ADMIN);
  if (!token) return { ok: false, semToken: true };
  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      let e: { code?: number; status?: string; message?: string } = {};
      try { e = ((await res.json()) as { error?: typeof e }).error ?? {}; } catch { /* corpo não-JSON */ }
      const erro = { status: res.status, code: e.code, gstatus: e.status, message: e.message ?? "" };
      // Só código/status/mensagem, nunca token ou corpo enviado.
      console.error(`[dados/google-admin] ${metodo} ${url.split("?")[0]}`, erro.status, erro.code ?? "", erro.gstatus ?? "", erro.message);
      return { ok: false, erro };
    }
    const texto = await res.text();
    return { ok: true, json: (texto ? JSON.parse(texto) : {}) as T };
  } catch (e) {
    console.error("[dados/google-admin]", e instanceof Error ? `${e.name}: ${e.message}` : "erro");
    return { ok: false, rede: true };
  }
}

const apiDesligada = (m: string) => /has not been used|is disabled|API not enabled|SERVICE_DISABLED|accessNotConfigured/i.test(m);

/** Traduz a falha numa mensagem pra tela. `contexto` muda a mensagem do 403. */
function traduzir(r: Exclude<Resposta<unknown>, { ok: true }>, contexto: "ga4" | "verificacao" | "gsc"): string {
  if ("semToken" in r) return ERRO_CONFIG;
  if ("rede" in r) return ERRO_GENERICO;
  const { status, message } = r.erro;
  if (apiDesligada(message)) {
    if (contexto === "ga4") return "Ative a Google Analytics Admin API no projeto do Google Cloud";
    if (contexto === "gsc") return "Ative a Google Search Console API no projeto do Google Cloud";
    return ERRO_API_DESLIGADA;
  }
  if (status === 403 || status === 401) {
    if (contexto === "ga4") return "A conta yide-dados não tem permissão de Editor no Google Analytics da Yide";
    if (contexto === "gsc") return "A conta yide-dados não conseguiu adicionar o site no Search Console (sem permissão).";
    return "A conta yide-dados não tem permissão pra verificar esse domínio.";
  }
  if (status === 429) return "Limite de uso do Google atingido. Tente de novo mais tarde.";
  if (status === 400) return `O Google recusou o pedido: ${message || "dados inválidos"}`.slice(0, 300);
  return ERRO_GENERICO;
}

/** Conta do GA4 onde as propriedades são criadas. Env GA4_ACCOUNT_ID (numérico) ou a conta da Yide. */
function contaGa4(): string {
  const env = process.env.GA4_ACCOUNT_ID?.trim().replace(/^accounts\//, "");
  return env && /^\d+$/.test(env) ? env : GA4_ACCOUNT_PADRAO;
}

/** Cria propriedade GA4 + fluxo web do site. Devolve o id da propriedade (só o número) e o G-XXXX. */
export async function criarPropriedadeGa4(i: { nomeCliente: string; siteUrl: string }): Promise<ResultadoAdmin<{ propertyId: string; measurementId: string }>> {
  try {
    const prop = await chamar<{ name?: string }>("POST", "https://analyticsadmin.googleapis.com/v1beta/properties", {
      parent: `accounts/${contaGa4()}`,
      displayName: i.nomeCliente.slice(0, 100),
      timeZone: "America/Cuiaba",
      currencyCode: "BRL",
      industryCategory: "OTHER",
    });
    if (!prop.ok) return { ok: false, erro: traduzir(prop, "ga4") };
    const propertyId = prop.json.name?.replace(/^properties\//, "");
    if (!propertyId || !/^\d+$/.test(propertyId)) {
      console.error("[dados/google-admin] propriedade sem name");
      return { ok: false, erro: ERRO_GENERICO };
    }
    const stream = await chamar<{ webStreamData?: { measurementId?: string } }>(
      "POST", `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`,
      { type: "WEB_DATA_STREAM", displayName: "Site", webStreamData: { defaultUri: i.siteUrl } },
    );
    if (!stream.ok) {
      // A propriedade já existe: devolve erro citando o id pra ninguém criar de novo às cegas.
      return { ok: false, erro: `Propriedade ${propertyId} criada, mas o fluxo do site falhou: ${traduzir(stream, "ga4")}` };
    }
    const measurementId = stream.json.webStreamData?.measurementId;
    if (!measurementId) {
      console.error("[dados/google-admin] fluxo sem measurementId", propertyId);
      return { ok: false, erro: `Propriedade ${propertyId} criada, mas o Google não devolveu o ID de medição.` };
    }
    return { ok: true, propertyId, measurementId };
  } catch (e) {
    console.error("[dados/google-admin] ga4", e instanceof Error ? e.message : "erro");
    return { ok: false, erro: ERRO_GENERICO };
  }
}

/** Gera o valor do TXT ("google-site-verification=…") pra verificar o domínio por DNS. */
export async function gerarTokenVerificacao(dominio: string): Promise<ResultadoAdmin<{ token: string }>> {
  try {
    const r = await chamar<{ token?: string }>("POST", "https://www.googleapis.com/siteVerification/v1/token", {
      site: { type: "INET_DOMAIN", identifier: dominio },
      verificationMethod: "DNS_TXT",
    });
    if (!r.ok) return { ok: false, erro: traduzir(r, "verificacao") };
    if (!r.json.token) return { ok: false, erro: ERRO_GENERICO };
    return { ok: true, token: r.json.token };
  } catch (e) {
    console.error("[dados/google-admin] token", e instanceof Error ? e.message : "erro");
    return { ok: false, erro: ERRO_GENERICO };
  }
}

/** Verifica o TXT no DNS e adiciona a propriedade de domínio no Search Console da conta de serviço. */
export async function verificarEAdicionarSearchConsole(dominio: string): Promise<ResultadoAdmin<{ gscSiteUrl: string }>> {
  try {
    const v = await chamar<unknown>(
      "POST", "https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT",
      { site: { type: "INET_DOMAIN", identifier: dominio } },
    );
    if (!v.ok) {
      // 400 na verificação = o Google não achou o TXT (ainda).
      if ("erro" in v && v.erro.status === 400 && !apiDesligada(v.erro.message)) return { ok: false, erro: ERRO_TXT_AUSENTE };
      return { ok: false, erro: traduzir(v, "verificacao") };
    }
    const gscSiteUrl = `sc-domain:${dominio}`;
    const add = await chamar<unknown>("PUT", `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}`);
    if (!add.ok) return { ok: false, erro: `Domínio verificado, mas não deu pra adicionar no Search Console: ${traduzir(add, "gsc")}` };
    return { ok: true, gscSiteUrl };
  } catch (e) {
    console.error("[dados/google-admin] gsc", e instanceof Error ? e.message : "erro");
    return { ok: false, erro: ERRO_GENERICO };
  }
}

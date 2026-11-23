/** Helpers puros do site do cliente (sem server-only: usados no cartão e no servidor). */

/** Host aceitável de site: tem ponto, não é IP nem localhost. Recebe hostname já minúsculo e sem ponto final. */
function hostValido(host: string): boolean {
  if (!host || !host.includes(".")) return false;
  if (host.startsWith("[") || host.includes(":")) return false; // IPv6
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // IPv4
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  return true;
}

/** Hostname minúsculo e sem ponto final, ou null se a URL não for http(s) válida. */
function hostDe(url: URL): string | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return hostValido(host) ? host : null;
}

/** Normaliza pra origem (https://exemplo.com.br). Aceita sem protocolo. null = inválido (inclui IP e localhost). */
export function normalizarSiteUrl(entrada: string): string | null {
  const t = entrada.trim();
  if (!t) return null;
  const comProtocolo = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(comProtocolo);
    const host = hostDe(u);
    if (!host) return null;
    return `${u.protocol}//${host}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return null;
  }
}

/** Host exato que o Google verifica (sem "www.", minúsculo, ASCII/punycode). null = inválido. */
export function dominioDoSite(siteUrl: string | null | undefined): string | null {
  if (!siteUrl) return null;
  try {
    const host = hostDe(new URL(siteUrl));
    return host ? host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/** Sufixos públicos de 2 níveis mais comuns pros nossos clientes (sem dependência da Public Suffix List). */
export const SUFIXOS_2_NIVEIS = [
  "com.br", "net.br", "org.br", "gov.br", "edu.br", "art.br", "adv.br", "eng.br", "med.br", "arq.br",
  "blog.br", "ind.br", "inf.br", "tur.br", "srv.br", "co.uk", "com.au", "com.ar", "com.mx", "com.pt",
] as const;

/** Domínio registrável (onde fica a zona DNS): exemplo.com.br de loja.exemplo.com.br. */
export function dominioRegistravel(host: string): string {
  const partes = host.toLowerCase().replace(/\.$/, "").split(".");
  const ult2 = partes.slice(-2).join(".");
  const n = (SUFIXOS_2_NIVEIS as readonly string[]).includes(ult2) ? 3 : 2;
  return partes.slice(-n).join(".");
}

/** Nome do registro TXT dentro da zona: "@" no domínio raiz, senão o subdomínio ("loja"). */
export function nomeRegistroTxt(host: string): string {
  const reg = dominioRegistravel(host);
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === reg ? "@" : h.slice(0, -(reg.length + 1));
}

/** Domínios de plataformas (o cliente não controla o DNS). */
export const SUFIXOS_PLATAFORMA = [
  "wixsite.com", "negocio.site", "mercadoshops.com.br", "webnode.page", "godaddysites.com", "square.site",
  "vercel.app", "netlify.app", "github.io", "blogspot.com", "wordpress.com", "lojaintegrada.com.br",
  "nuvemshop.com.br", "myshopify.com",
] as const;

export const MSG_PLATAFORMA =
  "Esse site está numa plataforma (domínio da plataforma); não dá pra verificar pelo DNS. Peça o domínio próprio do cliente.";

/** Sufixo da plataforma se o site está num domínio de plataforma (ex.: loja.wixsite.com), senão null. */
export function plataformaDoSite(siteUrl: string | null | undefined): string | null {
  const host = dominioDoSite(siteUrl);
  if (!host) return null;
  return SUFIXOS_PLATAFORMA.find((suf) => host === suf || host.endsWith(`.${suf}`)) ?? null;
}

/** Marcador de "criação do GA4 em andamento" em ga4_measurement_id. Nunca é um ID de medição. */
export const GA4_PENDENTE = "pendente";
/** ID de medição real (G-XXXX), ou null (inclui o marcador de pendente). */
export function measurementIdValido(v: string | null | undefined): string | null {
  return v && /^G-[A-Z0-9]+$/i.test(v) ? v : null;
}

/** Código de instalação do GA4 (gtag.js). null se não for um G-XXXX (ex.: "pendente"). */
export function snippetGa4(measurementId: string | null | undefined): string | null {
  if (!measurementId || !measurementIdValido(measurementId)) return null;
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>` +
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');</script>`;
}

/** Mensagem pronta pro cliente adicionar o TXT de verificação no DNS. `dominio` = domínio registrável (zona DNS), pra exibição. */
export function mensagemVerificacaoDns(i: { dominio: string; nome: string; txt: string }): string {
  const nome = i.nome === "@" ? "nome @ (ou em branco)" : `nome ${i.nome}`;
  return `Olá! Para conectarmos o Google Search Console do seu site, adicione no DNS do domínio ${i.dominio} um registro do tipo TXT, ${nome}, com o valor: ${i.txt}. Depois é só nos avisar.`;
}

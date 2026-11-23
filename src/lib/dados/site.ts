/** Helpers puros do site do cliente (sem server-only: usados no cartão e no servidor). */

/** Normaliza pra origem (https://exemplo.com.br). Aceita sem protocolo. null = inválido. */
export function normalizarSiteUrl(entrada: string): string | null {
  const t = entrada.trim();
  if (!t) return null;
  const comProtocolo = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(comProtocolo);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") || u.username || u.password) return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

/** Domínio do site (sem "www.", minúsculo), pra verificação DNS e propriedade sc-domain. null = inválido. */
export function dominioDoSite(siteUrl: string | null | undefined): string | null {
  if (!siteUrl) return null;
  try {
    const u = new URL(siteUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/** Código de instalação do GA4 (gtag.js). */
export function snippetGa4(measurementId: string): string {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>` +
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');</script>`;
}

/** Mensagem pronta pro cliente adicionar o TXT de verificação no DNS. */
export function mensagemVerificacaoDns(dominio: string, txt: string): string {
  return `Olá! Para conectarmos o Google Search Console do seu site, adicione no DNS do domínio ${dominio} um registro do tipo TXT, nome @ (ou em branco), com o valor: ${txt}. Depois é só nos avisar.`;
}

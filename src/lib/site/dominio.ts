// Domínio principal do site público. Antes da troca de domínio na Vercel, a flag
// SITE_APEX_ATIVO fica desligada e nada é redirecionado (o apex ainda é o site antigo).
export const APEX = "yidedigital.com.br";
const BLOG_HOST = "blog.yidedigital.com.br";
const SISTEMA_HOST = "sistemaacompanha.yidedigital.com.br";
const PREFIXOS_PUBLICOS = ["/blog", "/servicos", "/cases", "/sobre", "/diagnostico", "/politica-de-privacidade", "/perguntas-frequentes"];

function ehPrefixo(pathname: string, p: string): boolean {
  return pathname === p || pathname.startsWith(`${p}/`);
}

/** URL de destino (308) para levar conteúdo público ao domínio principal, ou null. */
export function destinoCanonico(host: string, pathname: string, search: string, ativo: boolean): string | null {
  if (!ativo) return null;
  const apex = (path: string) => `https://${APEX}${path}${search}`;
  if (pathname === "/site" && (host === APEX || host === SISTEMA_HOST || host === BLOG_HOST)) return apex("/");
  if (host === BLOG_HOST) return apex(pathname === "/" ? "/blog" : pathname);
  if (host === SISTEMA_HOST && PREFIXOS_PUBLICOS.some((p) => ehPrefixo(pathname, p))) return apex(pathname);
  return null;
}

export function apexAtivo(): boolean {
  return process.env.SITE_APEX_ATIVO === "1";
}

// URL pública base do site institucional (pro canonical, JSON-LD e sitemap).
// Conteúdo público (blog em /blog, serviços em /servicos, cases em /cases) fica em
// blog.yidedigital.com.br: o domínio principal é outro site, fora deste projeto, e
// dá 404 nessas páginas. Ajustável por env NEXT_PUBLIC_SITE_URL.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://blog.yidedigital.com.br").replace(/\/+$/, "");

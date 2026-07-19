// URL pública base do site institucional (pro canonical, JSON-LD e sitemap).
// Tudo consolidado no domínio da marca: yidedigital.com.br (home em /, blog em /blog,
// serviços em /servicos, cases em /cases). Ajustável por env NEXT_PUBLIC_SITE_URL.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://yidedigital.com.br").replace(/\/+$/, "");

// URL pública base do site (pro canonical, JSON-LD e sitemap). Ajustável por env.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sistemaacompanha.yidedigital.com.br").replace(/\/+$/, "");

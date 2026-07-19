// URL pública base do blog (pro canonical, JSON-LD e sitemap). O blog é servido no
// domínio da marca (subdomínio blog.yidedigital.com.br → aponta pra este projeto Vercel via CNAME).
// Ajustável por env NEXT_PUBLIC_SITE_URL se o domínio mudar.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://blog.yidedigital.com.br").replace(/\/+$/, "");

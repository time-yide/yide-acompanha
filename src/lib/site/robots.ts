export const MARKETING_HOSTS = new Set(["blog.yidedigital.com.br", "yidedigital.com.br", "www.yidedigital.com.br"]);

// "/site$": sem o "$", "/site" bloquearia também o /sitemap.xml.
const INTERNO = [
  "/site$", "/programacao", "/clientes", "/cliente", "/login", "/api", "/auth",
  "/aprovacao-design", "/aprovacao-post", "/definir-senha", "/recuperar-senha",
  "/relatorio-redes-sociais-pdf", "/relatorio-trafego-pdf", "/apresenta-yide-pdf",
];

// Robôs de busca e de IA liberados de forma explícita (o ChatGPT busca via Bing e OAI-SearchBot).
const ROBOS_BUSCA_E_IA = [
  "Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Google-Extended", "Applebot-Extended",
];

export interface RegraRobots { userAgent: string; allow?: string; disallow: string | string[] }

export function regrasRobots(host: string, siteUrl: string): { rules: RegraRobots[]; sitemap?: string } {
  if (!MARKETING_HOSTS.has(host)) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: INTERNO },
      ...ROBOS_BUSCA_E_IA.map((userAgent) => ({ userAgent, allow: "/", disallow: INTERNO })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

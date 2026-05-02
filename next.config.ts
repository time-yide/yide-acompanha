import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  // Identificadores do projeto Sentry (slugs visíveis na URL do dashboard)
  org: "yide-interno",
  project: "javascript-nextjs",

  // Não falha o build da Vercel se o Sentry estiver fora do ar / sem auth token
  silent: !process.env.CI,

  // Sobe os source maps pra Sentry conseguir mostrar stack traces legíveis em
  // produção. Requer SENTRY_AUTH_TOKEN configurado no Vercel — sem ele, falha
  // silenciosamente e os erros ficam minificados (mas ainda funciona).
  widenClientFileUpload: true,

  // Tunela requests do client pra Sentry pelo próprio domínio do app, evitando
  // que ad-blockers comam os events.
  tunnelRoute: "/monitoring",

  // Esconde source maps do response final pra evitar exposição de código
  sourcemaps: { disable: false },
  disableLogger: true,

  // Habilita a integração com Vercel Cron Jobs (auto-instrumenta os endpoints)
  automaticVercelMonitors: true,
});

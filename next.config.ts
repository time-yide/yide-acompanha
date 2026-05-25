import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    // AVIF é ~30% menor que WebP, mas demora um pouco mais pra codificar.
    // Next.js cacheia o resultado, então o custo é só na primeira requisição.
    formats: ["image/avif", "image/webp"],
    // Por padrão Next gera muitos tamanhos. Reduzimos pra os que realmente
    // usamos: avatares (32, 96), logos (80, 144, 176) e algumas variações.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 176, 256, 384],
  },
  // @sparticuz/chromium ships a binário do Chromium + libs (.so) dentro do
  // pacote npm. Se Next.js bundlar via Turbopack, perde os arquivos não-JS
  // (libnss3.so etc) e o launch falha com "error while loading shared
  // libraries". Marca como externo pra ficar no node_modules como native dep.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Vercel não traça automaticamente os arquivos .so / .br do
  // @sparticuz/chromium — força inclusão na função que roda Puppeteer
  // (geração de PDF é triggada via server action chamada da página
  // /social-media/apresenta-yide/[id]).
  outputFileTracingIncludes: {
    "/social-media/apresenta-yide/[id]": [
      "./node_modules/@sparticuz/chromium/**/*",
    ],
    "/social-media/apresenta-yide": [
      "./node_modules/@sparticuz/chromium/**/*",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Tree-shake agressivo em libs grandes/barrel-import. Cada import de
    // `lucide-react`/`date-fns`/`recharts` pega só o que usa em vez do bundle
    // inteiro — diminui o chunk client de todas as páginas.
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "@base-ui/react"],
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

import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_PROJECT_ID: z.string().min(1),
  RESEND_API_KEY: z.string().min(10),
  RESEND_FROM: z.string().min(5),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // Opcional: usado pelo endpoint do cron. Sem isso, o endpoint retorna 401 pra qualquer request.
  CRON_SECRET: z.string().optional(),
  // Opcional: usado pelo synthesizer da satisfação. Sem isso, IA não roda mas avaliação manual continua.
  ANTHROPIC_API_KEY: z.string().optional(),
  // Web Push (PWA): se ausentes, push é desabilitado silenciosamente.
  // Gere com: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  // Gerador de Leads (COMERCIAL → Gerador de Leads).
  // Sem isso, criar pesquisa retorna erro pedindo pra configurar.
  // Conta grátis em https://app.outscraper.com (2k créditos sem cartão).
  OUTSCRAPER_API_KEY: z.string().optional(),
  // Enriquecimento Fase 2 - opcional. Sem essa key, o enriquecimento
  // ainda roda usando só site scraping (gratuito) + IA Claude.
  // Free tier: 25 buscas/mês em hunter.io.
  HUNTER_API_KEY: z.string().optional(),
  // CNPJá - consulta CNPJ + sócios oficiais da Receita Federal.
  // Sem essa key, lookup é skip e enriquecimento usa só site scraping + Hunter + IA.
  // Free tier: 100 consultas/mês. Plano Basic R$99/mês = 15k consultas.
  // Cadastro em https://cnpja.com → Dashboard → API Keys.
  CNPJA_API_KEY: z.string().optional(),
  // Apify - usado pra scraping de perfis de Instagram (pega bio, contato, etc).
  // Free tier: $5/mês de créditos (~100 perfis).
  // Settings → Integrations → API tokens em apify.com
  APIFY_API_TOKEN: z.string().optional(),
  // Meta Ads (Facebook) - System User access token gerado na BM da Yide.
  // Sem isso, sync com Meta fica desabilitado (módulo /trafego ainda funciona
  // pra cadastro manual). Doc de setup em docs/trafego-meta-setup.md
  META_SYSTEM_USER_TOKEN: z.string().optional(),
  // Versão da Graph API a usar. Default: v21.0 (atual em mai/2026).
  META_GRAPH_API_VERSION: z.string().optional(),
  // Apresenta Yide - HMAC secret pra autorizar Puppeteer a buscar a rota
  // interna de HTML do PDF. Sem isso, geração de PDF falha amigavelmente.
  // Gere com: openssl rand -hex 32
  APRESENTACAO_PDF_SECRET: z.string().min(16).optional(),
  // Google Places API - usado pra puxar nota/reviews do GMB de cada cliente.
  // Opcional: sem essa key, modo automático fica desabilitado e sistema cai
  // pro modo manual (assessor digita os dados). Gerar em Google Cloud →
  // APIs & Services → Credentials → Create API key. Ativar "Places API (New)".
  GOOGLE_PLACES_API_KEY: z.string().min(20).optional(),
  // Yori — editor de vídeo com IA. Sem essas vars, /audiovisual/yori
  // redireciona pra /audiovisual com mensagem "Yori indisponível".
  // Setup do AWS Lambda: ver docs/yori-aws-lambda-setup.md.
  YORI_ENABLED: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  REMOTION_LAMBDA_FUNCTION_NAME: z.string().optional(),
  REMOTION_LAMBDA_SITE_NAME: z.string().optional(),
  // Editor de vídeo IA (Shotstack). Sem essa key (+ GROQ_API_KEY) o módulo
  // fica desligado. Cadastro em https://shotstack.io.
  SHOTSTACK_API_KEY: z.string().optional(),
  // Ambiente Shotstack: sandbox (watermark) ou production. Default: sandbox.
  SHOTSTACK_ENV: z.enum(["sandbox", "production"]).optional(),
  // Zenvia Voz (ex-TotalVoice) - token de API pra ligações de voz no módulo
  // /ligacoes. Sem isso, o cliente Zenvia é no-op (discar retorna erro
  // amigável). Pegar em painel Zenvia → Desenvolvedores → API.
  ZENVIA_VOICE_TOKEN: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // Pública VAPID - exposta ao browser pra criar Push Subscription.
  // Sem isso, botão "Ativar notificações" fica oculto.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
});

// Server-only environment variables (only accessible from server components/actions)
let serverEnv: z.infer<typeof serverSchema> | null = null;

function getServerEnv() {
  if (!serverEnv) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
      throw new Error("Invalid environment variables");
    }
    serverEnv = parsed.data;
  }
  return serverEnv;
}

// Client-safe environment variables
export const env = (() => {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  if (!parsed.success) {
    console.error("❌ Invalid client environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
})();

export { getServerEnv };

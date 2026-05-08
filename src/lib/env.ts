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
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // Pública VAPID — exposta ao browser pra criar Push Subscription.
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

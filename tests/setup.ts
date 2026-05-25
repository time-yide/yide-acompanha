// Vitest setup global: roda antes de qualquer teste importar código de app.
//
// Por quê:
// - `src/lib/env.ts` valida `process.env` no top-level via Zod e dá throw se
//   faltar `NEXT_PUBLIC_SUPABASE_URL`, `_ANON_KEY` ou `_APP_URL`. Como muitos
//   testes importam módulos que importam env (direta ou indiretamente), sem
//   esses vars setados, o import falha antes do teste rodar.
// - Aqui só seta valores fake suficientes pra passar no schema.
//
// O alias de `server-only` e o mock de `web-push` ficam em `vitest.config.ts`
// (precisam estar disponíveis no resolve, não em runtime).

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key-with-enough-length-for-zod";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key-with-enough-length";
process.env.SUPABASE_PROJECT_ID ??= "test-project";
process.env.RESEND_API_KEY ??= "test-resend-key";
process.env.RESEND_FROM ??= "test@example.com";

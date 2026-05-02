// Configuração do Sentry para o ambiente Node (Server Components, Server Actions,
// Route Handlers). Importado via instrumentation.ts.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Captura amostra completa de erros, mas só 10% das requisições pra performance
    // tracing — evita estourar a quota free de 5k erros/mês com volume normal.
    tracesSampleRate: 0.1,
    // Em prod, não envia eventos de debug. Em dev, envia tudo.
    debug: false,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Filtra ruído conhecido — erros de RLS que voltam como mensagem
    // padrão do Postgres não são incidentes, são policy enforcement.
    ignoreErrors: [
      /new row violates row-level security policy/i,
      /permission denied for/i,
    ],
  });
}

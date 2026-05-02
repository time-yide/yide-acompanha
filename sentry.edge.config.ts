// Configuração do Sentry pro Edge Runtime (middleware, edge route handlers).
// Importado via instrumentation.ts quando NEXT_RUNTIME='edge'.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}

// Hook de inicialização que o Next.js chama uma vez no boot do servidor.
// Carrega a config certa do Sentry pro runtime ativo.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Hook do Next.js 15+ que captura erros de requisição no servidor pra mandar
// pro Sentry (com toda a metadata de URL/headers/user agent).
export const onRequestError = Sentry.captureRequestError;

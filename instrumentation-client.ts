// Configuração do Sentry no browser. O Next.js 15+ carrega esse arquivo
// automaticamente no client-side bundle.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Replay: grava sessão quando há erro pra ver o que o usuário fez antes.
    // 0% normal, 100% quando erra — fica barato e útil pra debug.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Replay NÃO entra aqui (eager): ele instrumenta cliques/DOM continuamente
    // e pesava no INP do mobile já na hidratação. É adicionado depois, quando a
    // página fica ociosa (ver abaixo) — o replay-on-erro segue funcionando.
    integrations: [],
    debug: false,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    ignoreErrors: [
      // Extensões de browser que poluem
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Network failures que não são bugs do app
      "Network request failed",
      "Load failed",
    ],
  });

  // Inicializa o Replay só quando o main-thread estiver ocioso, pra não competir
  // com a hidratação e os primeiros toques (o pior momento de INP no celular).
  const startReplay = () => {
    Sentry.getClient()?.addIntegration(
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    );
  };
  const ric = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
  }).requestIdleCallback;
  if (typeof ric === "function") {
    ric(startReplay, { timeout: 5000 });
  } else {
    setTimeout(startReplay, 3000);
  }
}

// Hook obrigatório no Next.js 15+ pra Sentry trackear navegação client-side.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

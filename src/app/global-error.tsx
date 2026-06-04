"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import NextError from "next/error";
import { isChunkLoadError, reloadForFreshVersion } from "@/lib/chunk-recovery";

// Erros catastróficos que o Next.js global-error handler pega - captura no Sentry
// antes de mostrar o fallback. Erros normais de rota são pegos pelo error.tsx
// (que não temos ainda) ou pelo onRequestError em instrumentation.ts.
//
// Caso especial: erro de chunk (= página numa versão antiga depois de um
// deploy). Em vez de mostrar tela de erro, recarrega pra pegar a versão nova.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) {
      // Recarrega pra buscar o deploy novo. Se a trava impedir (reload recente),
      // cai pro fallback normal e reporta - aí não é só versão velha.
      if (reloadForFreshVersion()) return;
    }
    Sentry.captureException(error);
  }, [error, chunkError]);

  if (chunkError) {
    return (
      <html lang="pt-BR">
        <body
          style={{
            margin: 0,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#0a0a0a",
            background: "#ffffff",
          }}
        >
          <p style={{ fontSize: 15 }}>Atualizando para a versão mais recente...</p>
        </body>
      </html>
    );
  }

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}

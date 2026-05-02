"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import NextError from "next/error";

// Erros catastróficos que o Next.js global-error handler pega — captura no Sentry
// antes de mostrar o fallback. Erros normais de rota são pegos pelo error.tsx
// (que não temos ainda) ou pelo onRequestError em instrumentation.ts.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}

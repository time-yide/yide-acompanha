"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SolicitacoesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[solicitacoes] error boundary:", error);
  }, [error]);

  const msg = error.message || "Erro desconhecido";
  const tabelaFaltando = /relation .*client_portal_requests.* does not exist/i.test(msg);

  return (
    <div className="space-y-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
        <div className="flex-1 space-y-2">
          <h2 className="font-semibold text-rose-700 dark:text-rose-300">
            Erro ao carregar solicitações
          </h2>
          <p className="text-sm text-muted-foreground">{msg}</p>
          {tabelaFaltando && (
            <div className="mt-3 rounded-md border bg-background/40 p-3 text-xs">
              <p className="font-medium">Causa provável: migration não aplicada.</p>
              <p className="mt-1 text-muted-foreground">
                A tabela <code>client_portal_requests</code> não existe no
                Supabase. Rode a migration{" "}
                <code>20260530000000_client_portal_requests.sql</code> no SQL
                Editor.
              </p>
            </div>
          )}
          {error.digest && (
            <p className="text-[10px] text-muted-foreground">digest: {error.digest}</p>
          )}
        </div>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        Tentar de novo
      </Button>
    </div>
  );
}

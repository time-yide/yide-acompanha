"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncMetaForClientAction } from "@/lib/trafego/actions";

interface Props {
  clientId: string;
  /** Se cliente não tem meta_ad_account_id, o botão fica desabilitado com hint. */
  hasAdAccount: boolean;
  /** ISO string da última sync bem-sucedida. Pra mostrar "Última sync: ...". */
  lastSyncAt: string | null;
  /** Tipo de erro da última sync, se houve. Pra mostrar pill vermelho. */
  lastSyncError: string | null;
}

const ERROR_LABELS: Record<string, string> = {
  ad_account_not_found: "Ad Account não encontrado na BM",
  token_invalid: "Token Meta inválido",
  rate_limit: "Limite de requisições do Meta atingido",
  no_meta_account_id: "Cliente sem Meta Ad Account ID",
  api_error: "Erro genérico da API do Meta",
  client_not_found: "Cliente não encontrado",
};

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - ts) / 60_000);
  if (diffMin < 1) return "agora há pouco";
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const dt = new Date(iso);
  return dt.toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SyncMetaButton({ clientId, hasAdAccount, lastSyncAt, lastSyncError }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: "success"; campaigns: number; metrics: number }
    | { kind: "error"; message: string }
    | null
  >(null);

  function handleClick() {
    if (!hasAdAccount || pending) return;
    setFeedback(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    startTransition(async () => {
      const res = await syncMetaForClientAction(fd);
      if ("error" in res) {
        setFeedback({ kind: "error", message: res.error });
      } else {
        setFeedback({
          kind: "success",
          campaigns: res.campaigns_upserted,
          metrics: res.metrics_upserted,
        });
        router.refresh();
        // Auto-some o feedback de sucesso depois de 5s
        setTimeout(() => setFeedback(null), 5000);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {/* Última sync (texto pequeno) */}
        <div className="text-right text-[11px] text-muted-foreground">
          {lastSyncAt ? (
            <>
              Última sync:{" "}
              <span className="text-foreground">{formatRelativeTime(lastSyncAt)}</span>
            </>
          ) : (
            <span className="italic">Nunca sincronizado</span>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleClick}
          disabled={!hasAdAccount || pending}
          title={
            !hasAdAccount
              ? "Cadastre o Meta Ad Account ID do cliente primeiro"
              : "Puxa as últimas métricas do Meta Ads"
          }
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`}
          />
          {pending ? "Sincronizando..." : "Sincronizar agora"}
        </Button>
      </div>

      {/* Feedback inline */}
      {feedback?.kind === "success" && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          {feedback.campaigns} campanha(s) · {feedback.metrics} métricas atualizadas
        </div>
      )}
      {feedback?.kind === "error" && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300">
          <AlertCircle className="h-3 w-3" />
          {feedback.message}
        </div>
      )}

      {/* Erro persistente da última sync (vindo do banco, fica até resolver) */}
      {!feedback && lastSyncError && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-3 w-3" />
          Última sync com erro: {ERROR_LABELS[lastSyncError] ?? lastSyncError}
        </div>
      )}
    </div>
  );
}

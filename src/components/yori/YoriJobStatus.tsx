"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import type { YoriJob } from "@/lib/yori/tipos";

interface Props {
  initialJob: YoriJob;
}

const STATUS_MESSAGES: Record<YoriJob["status"], string> = {
  pending: "Na fila, aguardando começar...",
  transcribing: "Transcrevendo áudio com Whisper IA...",
  rendering: "Aplicando legendas no vídeo...",
  done: "Pronto!",
  error: "Algo deu errado.",
  cancelled: "Cancelado.",
};

export function YoriJobStatus({ initialJob }: Props) {
  const router = useRouter();
  // `initialJob` é a fonte da verdade: a cada `router.refresh()` o server re-renderiza
  // a página com o job atualizado e este componente recebe a nova prop. Sem state local
  // pra não mirrorar prop em state (anti-pattern + cascading renders).
  const job = initialJob;

  useEffect(() => {
    if (job.status === "done" || job.status === "error" || job.status === "cancelled") return;
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [job.status, router]);

  if (job.status === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Erro no processamento</p>
            <p className="mt-1 text-xs text-destructive/80">{job.error_message ?? "Erro desconhecido"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm font-medium">{STATUS_MESSAGES[job.status]}</p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${job.progress_pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {job.progress_pct}% · Tempo estimado: 30-90 segundos
      </p>
    </div>
  );
}

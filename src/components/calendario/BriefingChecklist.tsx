// src/components/calendario/BriefingChecklist.tsx
"use client";

import { useTransition } from "react";
import { Check, FileText, Printer, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  marcarLeuAction,
  marcarImprimiuAction,
  registrarBriefingGeradoAction,
} from "@/lib/briefing-gravacao/actions";

interface Props {
  eventoId: string;
  roteiroAbrirUrl: string;
  jaLeu: boolean;
  jaImprimiu: boolean;
  semRoteiro: boolean;
}

export function BriefingChecklist({
  eventoId,
  roteiroAbrirUrl,
  jaLeu,
  jaImprimiu,
  semRoteiro,
}: Props) {
  const [pendingLeu, startLeu] = useTransition();
  const [pendingImpr, startImpr] = useTransition();

  if (semRoteiro) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-300">
          Aguardando produção anexar o roteiro
        </p>
        <p className="mt-1 text-muted-foreground">
          Você não precisa fazer nada agora.
        </p>
      </div>
    );
  }

  function abrirRoteiroEMarcarLido() {
    window.open(roteiroAbrirUrl, "_blank", "noopener");
    startLeu(async () => {
      await marcarLeuAction(eventoId);
    });
  }

  function marcarLidoSemAbrir() {
    startLeu(async () => {
      await marcarLeuAction(eventoId);
    });
  }

  function gerarBriefing() {
    window.open(`/calendario/${eventoId}/briefing`, "_blank", "noopener");
    startImpr(async () => {
      await registrarBriefingGeradoAction(eventoId);
    });
  }

  function marcarImprimiuClick() {
    startImpr(async () => {
      await marcarImprimiuAction(eventoId);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {jaLeu ? (
              <Check className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground text-xs font-bold text-muted-foreground">
                1
              </span>
            )}
            <span className={jaLeu ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>
              Ler o roteiro
            </span>
          </div>
        </div>
        {!jaLeu && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={abrirRoteiroEMarcarLido} disabled={pendingLeu}>
              {pendingLeu ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Abrir roteiro
            </Button>
            <Button variant="ghost" size="sm" onClick={marcarLidoSemAbrir} disabled={pendingLeu}>
              Já li antes
            </Button>
          </div>
        )}
      </div>

      <div className={`rounded-md border p-4 ${!jaLeu ? "bg-muted/30 opacity-60" : "bg-card"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {jaImprimiu ? (
              <Check className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground text-xs font-bold text-muted-foreground">
                2
              </span>
            )}
            <span className={jaImprimiu ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>
              Gerar e imprimir o briefing
            </span>
          </div>
        </div>
        {jaLeu && !jaImprimiu && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={gerarBriefing} variant="outline">
              <FileText className="mr-2 h-4 w-4" /> Gerar folha pra imprimir
            </Button>
            <Button onClick={marcarImprimiuClick} disabled={pendingImpr}>
              {pendingImpr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Marquei como impresso
            </Button>
          </div>
        )}
      </div>

      {jaLeu && jaImprimiu && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          ✅ Pronto pra gravar
        </div>
      )}
    </div>
  );
}

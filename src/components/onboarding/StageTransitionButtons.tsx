"use client";

import { useState } from "react";
import { moveStageAction, markLostAction } from "@/lib/leads/actions";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import type { Stage } from "@/lib/leads/schema";

const STAGE_ORDER: Stage[] = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"];

const STAGE_LABEL: Record<Stage, string> = {
  prospeccao: "Prospecção",
  comercial: "Reunião Comercial",
  contrato: "Contrato",
  marco_zero: "Marco Zero",
  ativo: "Cliente ativo",
};

interface Props {
  leadId: string;
  currentStage: Stage;
  compact?: boolean;
}

export function StageTransitionButtons({ leadId, currentStage, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLost, setShowLost] = useState(false);
  const [motivo, setMotivo] = useState("");

  const idx = STAGE_ORDER.indexOf(currentStage);
  const next = idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
  const prev = idx > 0 ? STAGE_ORDER[idx - 1] : null;
  const isActive = currentStage === "ativo";

  async function move(toStage: Stage) {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("to_stage", toStage);
    const r = await moveStageAction(fd);
    setBusy(false);
    if (r && "error" in r && r.error) setError(r.error);
  }

  async function markLost() {
    if (motivo.length < 3) { setError("Informe o motivo (mín. 3 caracteres)"); return; }
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("motivo_perdido", motivo);
    const r = await markLostAction(fd);
    setBusy(false);
    if (r && "error" in r && r.error) setError(r.error);
    else { setShowLost(false); setMotivo(""); }
  }

  if (isActive) {
    return <p className="text-xs text-muted-foreground">Lead virou cliente ativo. Veja em /clientes.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {prev && (
          <Button size={compact ? "sm" : "default"} variant="outline" onClick={() => move(prev)} disabled={busy}>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            {compact ? "" : `Voltar para ${STAGE_LABEL[prev]}`}
          </Button>
        )}
        {next && (
          <Button size={compact ? "sm" : "default"} onClick={() => move(next)} disabled={busy}>
            {compact ? "" : `Avançar para ${STAGE_LABEL[next]}`}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
        {!showLost && (
          <Button size={compact ? "sm" : "default"} variant="ghost" onClick={() => setShowLost(true)} disabled={busy}>
            <X className="mr-1 h-3.5 w-3.5" />
            Marcar perdido
          </Button>
        )}
      </div>

      {showLost && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (ex.: cliente fechou com concorrente)"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={markLost} disabled={busy}>Confirmar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowLost(false); setMotivo(""); setError(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

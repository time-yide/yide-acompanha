"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { moveStageAction } from "@/lib/leads/actions";
import type { LeadRow } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/schema";

const STAGES: Stage[] = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"];

export function KanbanBoard({ groups }: { groups: Record<Stage, LeadRow[]> }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDrop(leadId: string, _fromStage: Stage, toStage: Stage) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", leadId);
      fd.set("to_stage", toStage);
      const r = await moveStageAction(fd);
      if (r && "error" in r && r.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-destructive/70 hover:text-destructive"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={pending ? "overflow-x-auto pb-4 opacity-70 pointer-events-none" : "overflow-x-auto pb-4"}>
        <div className="flex gap-3">
          {STAGES.map((s) => (
            <KanbanColumn
              key={s}
              stage={s}
              leads={groups[s]}
              onDropLead={(leadId, fromStage) => handleDrop(leadId, fromStage, s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

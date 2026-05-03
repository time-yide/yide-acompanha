"use client";

import { useState } from "react";
import { PacotePostadosModal } from "../modals/PacotePostadosModal";
import { cn } from "@/lib/utils";

interface Props {
  checklistId: string;
  clientNome: string;
  pacotePost: number | null;
  postados: number | null;
  canEdit: boolean;
}

export function PacotePostadosCell({
  checklistId, clientNome, pacotePost, postados, canEdit,
}: Props) {
  const [open, setOpen] = useState(false);
  const total = pacotePost ?? 0;
  const done = postados ?? 0;
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;

  if (!checklistId) {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }

  const isComplete = total > 0 && done >= total;

  return (
    <>
      <button
        type="button"
        onClick={() => canEdit && setOpen(true)}
        disabled={!canEdit}
        className={cn(
          "inline-flex w-full flex-col items-stretch gap-1 rounded-md px-2 py-1 text-left text-[11px] transition-colors",
          canEdit ? "hover:bg-muted" : "cursor-default",
        )}
      >
        <span className={cn(
          "font-semibold tabular-nums",
          isComplete && "text-emerald-600 dark:text-emerald-400",
        )}>
          {done} / {total || "—"}
        </span>
        {total > 0 && (
          <span className="h-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                "block h-full rounded-full transition-all",
                isComplete ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </button>
      {canEdit && (
        <PacotePostadosModal
          open={open}
          onOpenChange={setOpen}
          checklistId={checklistId}
          clientNome={clientNome}
          initialPacotePost={total}
          initialPostados={done}
        />
      )}
    </>
  );
}

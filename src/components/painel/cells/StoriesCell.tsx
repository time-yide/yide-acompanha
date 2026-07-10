"use client";

import { useState } from "react";
import { StoriesPostadosModal } from "../modals/StoriesPostadosModal";
import { cn } from "@/lib/utils";

interface Props {
  clientId: string;
  clientNome: string;
  mesReferencia: string;
  postados: number;
  meta: number;
  canEdit: boolean;
}

export function StoriesCell({
  clientId, clientNome, mesReferencia, postados, meta, canEdit,
}: Props) {
  const [open, setOpen] = useState(false);
  const pct = meta > 0 ? Math.min(100, (postados / meta) * 100) : 0;
  const isComplete = meta > 0 && postados >= meta;

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
          {postados} / {meta || "0"}
        </span>
        {meta > 0 && (
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
        <StoriesPostadosModal
          open={open}
          onOpenChange={setOpen}
          clientId={clientId}
          clientNome={clientNome}
          mesReferencia={mesReferencia}
          initialPostados={postados}
          meta={meta}
        />
      )}
    </>
  );
}

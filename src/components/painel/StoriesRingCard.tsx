"use client";

import { useState } from "react";
import { StoriesPostadosModal } from "./modals/StoriesPostadosModal";
import { cn } from "@/lib/utils";

interface Props {
  clientId: string;
  clientNome: string;
  assessorNome: string | null;
  quantidadeDiaria: number;
  mesReferencia: string;
  postados: number;
  meta: number;
  canEdit: boolean;
}

/** Card de stories com anel de progresso circular. Clica pra editar a contagem. */
export function StoriesRingCard({
  clientId,
  clientNome,
  assessorNome,
  quantidadeDiaria,
  mesReferencia,
  postados,
  meta,
  canEdit,
}: Props) {
  const [open, setOpen] = useState(false);

  const pct = meta > 0 ? Math.min(100, (postados / meta) * 100) : 0;
  const isComplete = meta > 0 && postados >= meta;

  // Geometria do anel (SVG).
  const size = 60;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  const ringColor = isComplete
    ? "stroke-emerald-500"
    : pct > 0
      ? "stroke-primary"
      : "stroke-muted-foreground/30";

  return (
    <>
      <button
        type="button"
        onClick={() => canEdit && setOpen(true)}
        disabled={!canEdit}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
          canEdit ? "hover:bg-muted/40" : "cursor-default",
        )}
      >
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              className="stroke-muted"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              className={cn("transition-all", ringColor)}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                isComplete && "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {postados}
            </span>
            <span className="text-[9px] text-muted-foreground">de {meta || 0}</span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{clientNome}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {quantidadeDiaria}/dia
            {assessorNome ? ` · ${assessorNome}` : ""}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[11px] font-medium tabular-nums",
              isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {Math.round(pct)}%
          </p>
        </div>
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

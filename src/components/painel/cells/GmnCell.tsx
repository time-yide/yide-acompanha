"use client";

import { useState } from "react";
import { Star, Sparkles } from "lucide-react";
import { GmnModal } from "../modals/GmnModal";
import { cn } from "@/lib/utils";

interface Props {
  checklistId: string;
  clientNome: string;
  mesReferencia: string;
  comentarios: number;
  avaliacoes: number;
  notaMedia: number | null;
  observacoes: string | null;
  otimizado: boolean;
  canEdit: boolean;
}

function colorByNota(nota: number | null): string {
  if (nota === null) return "border-muted-foreground/30 text-muted-foreground";
  if (nota >= 4.5) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (nota >= 3.5) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function GmnCell({
  checklistId, clientNome, mesReferencia,
  comentarios, avaliacoes, notaMedia, observacoes, otimizado, canEdit,
}: Props) {
  const [open, setOpen] = useState(false);
  if (!checklistId) {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }

  const semDados = notaMedia === null && comentarios === 0 && avaliacoes === 0;
  const tooltip = [
    observacoes,
    otimizado ? "Otimizado neste mês" : null,
  ].filter(Boolean).join(" · ") || undefined;

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => canEdit && setOpen(true)}
        disabled={!canEdit}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors",
          colorByNota(notaMedia),
          canEdit && "hover:opacity-80 cursor-pointer",
          !canEdit && "cursor-default",
        )}
        title={tooltip}
      >
        {semDados ? (
          "—"
        ) : (
          <>
            <Star className="h-3 w-3 fill-current" />
            <span className="tabular-nums">{(notaMedia ?? 0).toFixed(1)}</span>
          </>
        )}
      </button>
      {otimizado && (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          title="GMN otimizado neste mês"
          aria-label="GMN otimizado neste mês"
        >
          <Sparkles className="h-3 w-3" />
        </span>
      )}
      {canEdit && (
        <GmnModal
          open={open}
          onOpenChange={setOpen}
          checklistId={checklistId}
          clientNome={clientNome}
          mesReferencia={mesReferencia}
          initial={{ comentarios, avaliacoes, notaMedia, observacoes, otimizado }}
        />
      )}
    </div>
  );
}

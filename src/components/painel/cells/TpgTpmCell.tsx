"use client";

import { TpgTpmPopover } from "../modals/TpgTpmPopover";
import { cn } from "@/lib/utils";

interface Props {
  checklistId: string;
  field: "tpg_ativo" | "tpm_ativo";
  ativo: boolean | null;
  valorAcordado: number | null;
  canEdit: boolean;
}

export function TpgTpmCell({ checklistId, field, ativo, valorAcordado, canEdit }: Props) {
  if (!checklistId) {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }

  const label = ativo === null ? "—" : ativo ? "ATIVO" : "INATIVO";
  const colorClass =
    ativo === null
      ? "border-muted-foreground/30 text-muted-foreground"
      : ativo
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-muted-foreground/40 bg-muted text-muted-foreground";

  const trigger = (
    <button
      type="button"
      disabled={!canEdit}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border px-3 text-[10px] font-bold tracking-wider transition-colors",
        colorClass,
        canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default",
      )}
    >
      {label}
    </button>
  );

  if (!canEdit) return trigger;

  return (
    <TpgTpmPopover
      trigger={trigger}
      checklistId={checklistId}
      field={field}
      initialAtivo={ativo}
      valorAcordado={valorAcordado}
      canEdit={canEdit}
    />
  );
}

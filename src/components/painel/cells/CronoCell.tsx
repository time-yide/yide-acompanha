"use client";

import { useTransition } from "react";
import { Check, FolderOpen } from "lucide-react";
import { markStepProntoAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  stepId: string | null;
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  driveUrl: string | null;
  canEdit: boolean;
}

export function CronoCell({ stepId, status, driveUrl, canEdit }: Props) {
  const [pending, startTransition] = useTransition();

  if (!stepId) return <span className="text-[11px] text-muted-foreground/60">—</span>;

  const isPronto = status === "pronto";

  function marcarPronto() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await markStepProntoAction(fd);
      if (driveUrl) window.open(driveUrl, "_blank", "noopener,noreferrer");
    });
  }

  if (isPronto) {
    return (
      <a
        href={driveUrl ?? "#"}
        target={driveUrl ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
      >
        <Check className="h-3 w-3" />
        <FolderOpen className="h-3 w-3" />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={marcarPronto}
      disabled={!canEdit || pending}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground transition-colors",
        canEdit && !pending && "cursor-pointer hover:bg-muted",
        (!canEdit || pending) && "cursor-default opacity-60",
      )}
    >
      {pending ? "..." : "Pendente"}
    </button>
  );
}

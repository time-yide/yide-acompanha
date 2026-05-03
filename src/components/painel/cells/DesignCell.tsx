"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markStepProntoAction, delegarDesignAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  stepId: string | null;
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  responsavelNome: string | null;
  designerCadastrado: boolean;
  canMarkPronto: boolean;
  canDelegate: boolean;
}

export function DesignCell({
  stepId, status, responsavelNome, designerCadastrado,
  canMarkPronto, canDelegate,
}: Props) {
  const [pending, startTransition] = useTransition();

  if (!stepId) return <span className="text-[11px] text-muted-foreground/60">—</span>;

  function marcarPronto() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await markStepProntoAction(fd);
    });
  }

  function delegar() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await delegarDesignAction(fd);
    });
  }

  if (status === "pronto") {
    return (
      <span className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <Check className="h-3 w-3" />
      </span>
    );
  }

  if (status === "delegado" || status === "em_andamento") {
    return (
      <button
        type="button"
        onClick={canMarkPronto ? marcarPronto : undefined}
        disabled={!canMarkPronto || pending}
        title={responsavelNome ? `Delegado a ${responsavelNome}` : undefined}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-medium text-amber-700 dark:text-amber-300",
          canMarkPronto && !pending && "cursor-pointer hover:bg-amber-500/20",
        )}
      >
        Delegado
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={canDelegate && designerCadastrado ? delegar : undefined}
      disabled={!canDelegate || !designerCadastrado || pending}
      title={!designerCadastrado ? "Cadastre um designer no cliente" : "Delegar pro designer"}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground",
        canDelegate && designerCadastrado && !pending && "cursor-pointer hover:bg-muted",
        (!canDelegate || !designerCadastrado || pending) && "cursor-default opacity-60",
      )}
    >
      Delegar
    </button>
  );
}

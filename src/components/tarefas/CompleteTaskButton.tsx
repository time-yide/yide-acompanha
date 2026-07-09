"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleTaskCompletionAction } from "@/lib/tarefas/actions";
import { ConcludeOperationalModal } from "./ConcludeOperationalModal";

interface Props {
  taskId: string;
  isCompleted: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** Quando passado, sobrescreve o label do botão. */
  label?: string;
}

type DeliveryPrompt = {
  tipo: "geral" | "video" | "arte";
  atribuidoRole: string | null;
  toStatus: "concluida" | "em_aprovacao";
};

export function CompleteTaskButton({
  taskId, isCompleted, variant, size, className, label,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryPrompt | null>(null);

  const computedLabel = label ?? (isCompleted ? "Reabrir" : "Marcar como concluída");
  const computedVariant = variant ?? (isCompleted ? "outline" : "default");

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErro(null);

    startTransition(async () => {
      const result = await toggleTaskCompletionAction(taskId);
      if (!result) return;
      // Responsável de entrega: em vez de concluir direto, abre o modal
      // pedindo o link do material pronto (+ quantidade).
      if ("requiresDelivery" in result && result.requiresDelivery) {
        setDelivery(result.requiresDelivery);
        return;
      }
      if ("error" in result && result.error) {
        setErro(result.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={computedVariant}
        size={size}
        className={className}
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? "Salvando..." : computedLabel}
      </Button>
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
      {delivery && (
        <ConcludeOperationalModal
          open={delivery !== null}
          onOpenChange={(open) => {
            if (!open) setDelivery(null);
          }}
          taskId={taskId}
          taskTipo={delivery.tipo}
          atribuidoRole={delivery.atribuidoRole}
          toStatus={delivery.toStatus}
          onSuccess={() => {
            setDelivery(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

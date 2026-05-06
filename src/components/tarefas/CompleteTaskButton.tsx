"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleTaskCompletionAction } from "@/lib/tarefas/actions";
import { ArtesPromptModal } from "./ArtesPromptModal";

interface Props {
  taskId: string;
  isCompleted: boolean;
  userRole: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** Quando passado, sobrescreve o label do botão. */
  label?: string;
}

export function CompleteTaskButton({
  taskId, isCompleted, userRole, variant, size, className, label,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const computedLabel = label ?? (isCompleted ? "Reabrir" : "Marcar como concluída");
  const computedVariant = variant ?? (isCompleted ? "outline" : "default");

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErro(null);

    startTransition(async () => {
      const result = await toggleTaskCompletionAction(taskId);
      if (result && "requiresArtesPrompt" in result && result.requiresArtesPrompt) {
        setModalOpen(true);
        return;
      }
      if (result && "error" in result && result.error) {
        setErro(result.error);
      }
    });
  }

  function handleConfirmArtes(artes: number) {
    startTransition(async () => {
      const result = await toggleTaskCompletionAction(taskId, artes);
      if (result && "error" in result && result.error) {
        setErro(result.error);
        return;
      }
      setModalOpen(false);
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
      <ArtesPromptModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfirm={handleConfirmArtes}
        pending={pending}
      />
    </>
  );
}

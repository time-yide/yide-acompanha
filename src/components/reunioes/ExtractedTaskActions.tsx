"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import {
  aceitarTaskSugeridaAction,
  descartarTaskSugeridaAction,
} from "@/lib/reunioes/task-actions";

interface Props {
  extractedTaskId: string;
}

/**
 * Botões aceitar/descartar pra sugestão de tarefa da IA.
 * - Aceitar: cria task real em public.tasks atribuída ao sugerido pela IA
 *   (ou ao próprio user se IA não sugeriu ninguém)
 * - Descartar: marca como descartada (não cria task)
 */
export function ExtractedTaskActions({ extractedTaskId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAceitar() {
    setError(null);
    startTransition(async () => {
      const r = await aceitarTaskSugeridaAction({ extracted_task_id: extractedTaskId });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDescartar() {
    setError(null);
    startTransition(async () => {
      const r = await descartarTaskSugeridaAction({ extracted_task_id: extractedTaskId });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={handleAceitar}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400"
          title="Criar tarefa real a partir dessa sugestão"
          aria-label="Aceitar sugestão"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={handleDescartar}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          title="Descartar — não vira tarefa"
          aria-label="Descartar sugestão"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="max-w-[200px] text-right text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

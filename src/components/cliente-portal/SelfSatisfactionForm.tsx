"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { submitClientSelfSatisfactionAction } from "@/lib/cliente-portal/satisfacao-actions";

type ActionState =
  | { success: true }
  | { error: string }
  | null;

async function actionWrapper(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return submitClientSelfSatisfactionAction(formData);
}

export function SelfSatisfactionForm({ hasPrevious }: { hasPrevious: boolean }) {
  const [state, formAction, isPending] = useActionState(actionWrapper, null);
  const [score, setScore] = useState(8);
  const [open, setOpen] = useState(!hasPrevious); // Sem avaliação prévia? Já mostra o form expandido.

  const success = state && "success" in state;
  const errorMsg = state && "error" in state ? state.error : null;

  if (success) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
        ✓ Obrigada pela avaliação! A equipe já tem acesso à sua resposta.
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        Enviar nova avaliação
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="score-range" className="block text-xs font-medium">
          Sua nota: <span className="tabular-nums text-base font-bold">{score}</span>
          <span className="text-muted-foreground"> / 10</span>
        </label>
        <input
          id="score-range"
          name="score"
          type="range"
          min={0}
          max={10}
          step={1}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="mt-1 w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0 (péssima)</span>
          <span>10 (ótima)</span>
        </div>
      </div>

      <div>
        <label htmlFor="comentario" className="block text-xs font-medium">
          Comentário (opcional)
        </label>
        <textarea
          id="comentario"
          name="comentario"
          rows={3}
          maxLength={2000}
          placeholder="Conte o que está funcionando bem ou o que pode melhorar"
          className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

      <div className="flex gap-2">
        {hasPrevious && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isPending} className="flex-1">
          {isPending ? "Enviando..." : "Enviar avaliação"}
        </Button>
      </div>
    </form>
  );
}

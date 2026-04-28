"use client";

import { useState, useTransition } from "react";
import { marcarPerdidoAction } from "@/lib/prospeccao/actions";

interface Props {
  leadId: string;
  open: boolean;
  onClose: () => void;
}

export function MarcarPerdidoDialog({ leadId, open, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("lead_id", leadId);
    startTransition(async () => {
      const result = await marcarPerdidoAction(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Marcar como perdido</h3>
        <p className="text-sm text-muted-foreground">Por quê o prospect foi perdido? Essa info ajuda a melhorar a abordagem.</p>

        <div>
          <label className="text-sm font-medium">Motivo</label>
          <textarea
            name="motivo"
            rows={4}
            required
            minLength={3}
            maxLength={2000}
            className="mt-1 block w-full rounded-md border bg-card px-2 py-1.5 text-sm"
            placeholder="Cliente escolheu concorrente / sem orçamento / sumiu / etc."
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:opacity-90 disabled:opacity-50">
            {pending ? "Marcando..." : "Marcar como perdido"}
          </button>
        </div>
      </form>
    </div>
  );
}

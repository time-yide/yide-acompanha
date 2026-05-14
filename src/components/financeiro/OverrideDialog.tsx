"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOverrideAction, removeOverrideAction } from "@/lib/financeiro/actions";
import { Button } from "@/components/ui/button";

interface Props {
  expenseId: string;
  descricao: string;
  mesRef: string;
  valorAtual: number;
  onClose: () => void;
}

export function OverrideDialog({ expenseId, descricao, mesRef, valorAtual, onClose }: Props) {
  const router = useRouter();
  const [valor, setValor] = useState(String(valorAtual));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("expense_id", expenseId);
    fd.set("mes_referencia", mesRef);
    fd.set("valor", valor);
    if (motivo.trim()) fd.set("motivo", motivo.trim());
    startTransition(async () => {
      const r = await setOverrideAction(fd);
      if (r && "error" in r && r.error) setError(r.error);
      else { onClose(); router.refresh(); }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const r = await removeOverrideAction(expenseId, mesRef);
      if (r && "error" in r && r.error) setError(r.error);
      else { onClose(); router.refresh(); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-5 shadow-xl">
        <div>
          <h3 className="text-lg font-semibold">{descricao} · {mesRef}</h3>
          <p className="text-xs text-muted-foreground">Override só desse mês. Não afeta meses anteriores nem o valor padrão da despesa.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Valor neste mês</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Motivo (opcional)</span>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={pending}
            placeholder="Ex.: aumento sazonal de luz"
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={pending}>
            Remover override
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

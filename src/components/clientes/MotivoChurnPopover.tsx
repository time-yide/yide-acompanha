"use client";

import { useState, useTransition } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateClienteMotivoChurnAction } from "@/lib/clientes/actions";
import { CHURN_MOTIVOS, churnMotivoLabel } from "@/lib/clientes/schema";

interface Props {
  clienteId: string;
  currentCategoria: string | null;
  currentDetalhe: string | null;
}

export function MotivoChurnPopover({ clienteId, currentCategoria, currentDetalhe }: Props) {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<string>(currentCategoria ?? "");
  const [detalhe, setDetalhe] = useState<string>(currentDetalhe ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    if (!categoria) {
      setError("Selecione um motivo");
      return;
    }
    const fd = new FormData();
    fd.set("cliente_id", clienteId);
    fd.set("motivo_churn_categoria", categoria);
    fd.set("motivo_churn", detalhe);
    startTransition(async () => {
      const result = await updateClienteMotivoChurnAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCategoria(currentCategoria ?? "");
      setDetalhe(currentDetalhe ?? "");
      setError(null);
    }
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="cursor-pointer text-left text-sm text-muted-foreground hover:underline"
          >
            {currentCategoria ? (
              churnMotivoLabel(currentCategoria)
            ) : (
              <span className="italic opacity-60">+ definir</span>
            )}
          </button>
        }
      />
      <PopoverContent align="start" className="w-80">
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Motivo do churn</div>

          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">(Selecione)</option>
            {CHURN_MOTIVOS.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Detalhe (opcional)</label>
            <Textarea
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              disabled={pending}
              rows={3}
              maxLength={500}
              placeholder="Ex.: achou caro depois do reajuste"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

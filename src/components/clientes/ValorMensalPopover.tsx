"use client";

import { useState, useTransition } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { updateClienteFieldAction } from "@/lib/clientes/actions";

interface Props {
  clienteId: string;
  current: number;
  tipoRelacao: "comum" | "parceria" | "permuta";
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ValorMensalPopover({ clienteId, current, tipoRelacao }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(String(current));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isLocked = tipoRelacao !== "comum";

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("cliente_id", clienteId);
    fd.set("valor_mensal", value);
    startTransition(async () => {
      const result = await updateClienteFieldAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setValue(String(current));
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
            className="cursor-pointer text-right text-sm tabular-nums hover:underline"
          >
            {BRL(current)}
          </button>
        }
      />
      <PopoverContent align="end" className="w-64">
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Valor mensal</div>
          {isLocked ? (
            <p className="text-xs text-muted-foreground">
              Cliente em <strong>{tipoRelacao}</strong> — valor fixo em R$ 0. Mude o tipo de relação no detalhe pra editar.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={pending}
                  className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={pending}>
              {isLocked ? "Fechar" : "Cancelar"}
            </Button>
            {!isLocked && (
              <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

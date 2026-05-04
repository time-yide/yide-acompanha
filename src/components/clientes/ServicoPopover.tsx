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
  current: string | null;
}

export function ServicoPopover({ clienteId, current }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("cliente_id", clienteId);
    fd.set("servico_contratado", value);
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
      setValue(current ?? "");
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
            {current ?? "—"}
          </button>
        }
      />
      <PopoverContent align="start" className="w-72">
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Serviço contratado</div>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            placeholder="Ex.: Tráfego+Estratégia"
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-[11px] text-muted-foreground">
            Tipo de pacote será re-inferido automaticamente caso ainda não tenha sido revisado manualmente.
          </p>
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

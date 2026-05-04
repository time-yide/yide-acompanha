"use client";

import { useState, useTransition } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { updateClienteFieldAction } from "@/lib/clientes/actions";
import { TIPOS_PACOTE, tipoPacoteBadge } from "@/lib/painel/pacote-matrix";

interface Props {
  clienteId: string;
  current: string | null;
}

// Lista canônica de serviços (label exibido na tabela e na lista de seleção).
const SERVICO_OPTIONS = TIPOS_PACOTE.map((p) => tipoPacoteBadge(p).label);

export function ServicoPopover({ clienteId, current }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Se o valor atual não bate com nenhuma opção canônica (ex.: dado antigo
  // tipo "Tráfego+Comercial"), mostra um aviso pra contexto.
  const isCanonical = !current || SERVICO_OPTIONS.includes(current);

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

          {!isCanonical && current && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
              Valor atual <strong>{current}</strong> está fora da lista padrão. Ao escolher uma opção abaixo, ele será substituído.
            </p>
          )}

          <select
            value={isCanonical ? value : ""}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">(Sem serviço)</option>
            {SERVICO_OPTIONS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>

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

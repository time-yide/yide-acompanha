"use client";

import { useState, useTransition } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { updateClienteAssignmentAction } from "@/lib/clientes/actions";

type Field = "assessor" | "coordenador";

interface Option {
  id: string;
  nome: string;
}

interface Props {
  clienteId: string;
  field: Field;
  currentName: string | null;
  currentId: string | null;
  options: Option[];
}

const FIELD_LABEL: Record<Field, string> = {
  assessor: "assessor",
  coordenador: "coordenador",
};

export function AssignmentPopover({
  clienteId,
  field,
  currentName,
  currentId,
  options,
}: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(currentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const fieldKey = field === "assessor" ? "assessor_id" : "coordenador_id";
    const fd = new FormData();
    fd.set("cliente_id", clienteId);
    fd.set(fieldKey, value);

    startTransition(async () => {
      const result = await updateClienteAssignmentAction(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Reset state ao fechar para próximo open refletir valor atual.
      setValue(currentId ?? "");
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
            {currentName ?? "—"}
          </button>
        }
      />
      <PopoverContent align="start" className="w-64">
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            Atribuir {FIELD_LABEL[field]}
          </div>

          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">(Sem atribuição)</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={pending}
            >
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

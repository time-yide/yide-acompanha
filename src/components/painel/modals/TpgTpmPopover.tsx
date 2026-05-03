"use client";

import { useState, useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setTpgTpmAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  trigger: React.ReactElement;
  checklistId: string;
  field: "tpg_ativo" | "tpm_ativo";
  initialAtivo: boolean | null;
  valorAcordado: number | null;
  canEdit: boolean;
}

export function TpgTpmPopover({
  trigger, checklistId, field, initialAtivo, valorAcordado, canEdit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [ativo, setAtivo] = useState<boolean>(initialAtivo ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const titulo = field === "tpg_ativo" ? "Tráfego Pago Google" : "Tráfego Pago Meta";

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("checklist_id", checklistId);
    fd.set("field", field);
    fd.set("ativo", String(ativo));
    startTransition(async () => {
      const r = await setTpgTpmAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Popover open={open} onOpenChange={canEdit ? setOpen : undefined}>
      <PopoverTrigger render={trigger as React.ReactElement} />
      <PopoverContent className="w-72 space-y-4 p-4">
        <h3 className="text-sm font-semibold">{titulo}</h3>

        <div className="space-y-2">
          <Label className="text-xs">Status do mês</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAtivo(true)}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                ativo
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              Ativo
            </button>
            <button
              type="button"
              onClick={() => setAtivo(false)}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                !ativo
                  ? "border-foreground/40 bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              Inativo
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Valor acordado</Label>
          <p className="text-sm font-semibold tabular-nums">
            {valorAcordado !== null
              ? Number(valorAcordado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "Não cadastrado"}
          </p>
          <p className="text-[10px] text-muted-foreground">Edite no cadastro do cliente (só sócio/coord)</p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

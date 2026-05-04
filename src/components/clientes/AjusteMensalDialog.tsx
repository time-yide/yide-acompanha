"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setAjusteMensalAction, removeAjusteMensalAction } from "@/lib/clientes/actions";
import type { MonthlyAdjustment } from "@/lib/clientes/ajustes";

interface Props {
  clienteId: string;
  ajusteAtual?: MonthlyAdjustment | null;
}

function mesAtual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function AjusteMensalDialog({ clienteId, ajusteAtual }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"desconto_parcial" | "gratuidade_total">(
    ajusteAtual?.tipo ?? "desconto_parcial"
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();

  const currentMes = mesAtual();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await setAjusteMensalAction(formData);
      if (result && "error" in result && typeof result.error === "string") {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  function handleRemove() {
    setError(null);
    startRemoveTransition(async () => {
      const result = await removeAjusteMensalAction(
        clienteId,
        ajusteAtual?.mes_referencia ?? currentMes
      );
      if (result && "error" in result && typeof result.error === "string") {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            {ajusteAtual ? "Editar ajuste do mês" : "Lançar ajuste"}
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajuste mensal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="client_id" value={clienteId} />

          <div className="space-y-1">
            <Label htmlFor="mes_referencia">Mês de referência</Label>
            <Input
              id="mes_referencia"
              name="mes_referencia"
              type="month"
              defaultValue={ajusteAtual?.mes_referencia ?? currentMes}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de ajuste</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="desconto_parcial"
                  checked={tipo === "desconto_parcial"}
                  onChange={() => setTipo("desconto_parcial")}
                />
                <span className="text-sm">Desconto parcial</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value="gratuidade_total"
                  checked={tipo === "gratuidade_total"}
                  onChange={() => setTipo("gratuidade_total")}
                />
                <span className="text-sm">Gratuidade total (mês grátis)</span>
              </label>
            </div>
          </div>

          {tipo === "desconto_parcial" && (
            <div className="space-y-1">
              <Label htmlFor="valor_desconto">Valor do desconto (R$)</Label>
              <Input
                id="valor_desconto"
                name="valor_desconto"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={
                  ajusteAtual?.tipo === "desconto_parcial"
                    ? String(ajusteAtual.valor_desconto ?? "")
                    : ""
                }
                required
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              name="motivo"
              defaultValue={ajusteAtual?.motivo ?? ""}
              placeholder="Explique o motivo do ajuste (mín. 3 caracteres)"
              minLength={3}
              required
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            {ajusteAtual && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={isRemoving}
              >
                {isRemoving ? "Removendo..." : "Remover ajuste"}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar ajuste"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

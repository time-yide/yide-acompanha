"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (artesEntregues: number) => void | Promise<void>;
  pending?: boolean;
}

export function ArtesPromptModal({ open, onOpenChange, onConfirm, pending }: Props) {
  const [valor, setValor] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  // Reset via cleanup function: roda quando `open` muda de true→false ou no unmount.
  // Evita setState síncrono no body do effect (regra react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    return () => {
      setValor("");
      setErro(null);
    };
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0) {
      setErro("Use um número inteiro maior ou igual a 0");
      return;
    }
    void onConfirm(n);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quantas artes foram entregues?</DialogTitle>
          <DialogDescription>
            Informe quantas artes você produziu nessa tarefa. Se não foi de arte, coloque 0.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="artes_entregues">Quantidade</Label>
            <Input
              id="artes_entregues"
              type="number"
              min={0}
              step={1}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
              required
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Concluir tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

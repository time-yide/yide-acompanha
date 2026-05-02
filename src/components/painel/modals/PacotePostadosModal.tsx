"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setMonthlyPostsAction } from "@/lib/painel/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId: string;
  clientNome: string;
  initialPacotePost: number;
  initialPostados: number;
}

export function PacotePostadosModal({
  open, onOpenChange, checklistId, clientNome,
  initialPacotePost, initialPostados,
}: Props) {
  const [pacote, setPacote] = useState(String(initialPacotePost));
  const [postados, setPostados] = useState(String(initialPostados));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("checklist_id", checklistId);
    fd.set("pacote_post", pacote);
    fd.set("quantidade_postada", postados);
    startTransition(async () => {
      const r = await setMonthlyPostsAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Postagens — {clientNome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="pacote_post">Pacote contratado</Label>
            <Input
              id="pacote_post"
              type="number"
              min={0}
              value={pacote}
              onChange={(e) => setPacote(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade_postada">Postados até agora</Label>
            <Input
              id="quantidade_postada"
              type="number"
              min={0}
              value={postados}
              onChange={(e) => setPostados(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

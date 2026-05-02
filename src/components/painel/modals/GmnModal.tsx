"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setGmnDataAction } from "@/lib/painel/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId: string;
  clientNome: string;
  mesReferencia: string;
  initial: {
    comentarios: number;
    avaliacoes: number;
    notaMedia: number | null;
    observacoes: string | null;
  };
}

export function GmnModal({
  open, onOpenChange, checklistId, clientNome, mesReferencia, initial,
}: Props) {
  const [comentarios, setComentarios] = useState(String(initial.comentarios));
  const [avaliacoes, setAvaliacoes] = useState(String(initial.avaliacoes));
  const [nota, setNota] = useState(initial.notaMedia ?? 0);
  const [observacoes, setObservacoes] = useState(initial.observacoes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("checklist_id", checklistId);
    fd.set("gmn_comentarios", comentarios);
    fd.set("gmn_avaliacoes", avaliacoes);
    if (nota > 0) fd.set("gmn_nota_media", String(nota));
    if (observacoes.trim()) fd.set("gmn_observacoes", observacoes.trim());
    startTransition(async () => {
      const r = await setGmnDataAction(fd);
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
            <DialogTitle>GMN — {clientNome} — {mesReferencia}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="gmn_comentarios">Comentários do mês</Label>
              <Input id="gmn_comentarios" type="number" min={0} value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gmn_avaliacoes">Avaliações do mês</Label>
              <Input id="gmn_avaliacoes" type="number" min={0} value={avaliacoes} onChange={(e) => setAvaliacoes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmn_nota_media">Nota média (0.0 – 5.0)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="gmn_nota_media"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={nota}
                onChange={(e) => setNota(Number(e.target.value))}
                className="w-24"
              />
              <span className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="tabular-nums font-semibold">{nota.toFixed(1)}</span>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmn_observacoes">Observações de posicionamento (opcional)</Label>
            <Textarea
              id="gmn_observacoes"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: Cliente subiu 3 posições nas buscas locais"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

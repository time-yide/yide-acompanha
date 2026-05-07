"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateMetasComercialAction } from "@/lib/prospeccao/actions";

interface Props {
  comercialId: string;
  comercialNome: string;
  /** Valores configurados no profile (null quando não tem meta — usa fallback). */
  defaults: {
    meta_prospects_mes: number | null;
    meta_fechamentos_mes: number | null;
    meta_receita_mes: number | null;
  };
}

export function MetasEditDialog({ comercialId, comercialNome, defaults }: Props) {
  const [open, setOpen] = useState(false);
  const [prospects, setProspects] = useState(String(defaults.meta_prospects_mes ?? ""));
  const [fechamentos, setFechamentos] = useState(String(defaults.meta_fechamentos_mes ?? ""));
  const [receita, setReceita] = useState(String(defaults.meta_receita_mes ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("comercial_id", comercialId);
    if (prospects.trim() !== "") fd.set("meta_prospects_mes", prospects.trim());
    if (fechamentos.trim() !== "") fd.set("meta_fechamentos_mes", fechamentos.trim());
    if (receita.trim() !== "") fd.set("meta_receita_mes", receita.trim());

    startTransition(async () => {
      const r = await updateMetasComercialAction(fd);
      if (r && "error" in r) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Metas salvas");
      setOpen(false);
    });
  }

  function handleLimpar() {
    setProspects("");
    setFechamentos("");
    setReceita("");
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1 h-3.5 w-3.5" />
        Editar metas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Metas de {comercialNome}</DialogTitle>
            <DialogDescription>
              Define as metas mensais. Deixar vazio cai no fallback automático (3× fixo pra receita; defaults pra prospects/fechamentos).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta_prospects">Prospects abordados / mês</Label>
              <Input
                id="meta_prospects" type="number" min="0" step="1"
                value={prospects} onChange={(e) => setProspects(e.target.value)}
                placeholder="Ex.: 20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_fechamentos">Fechamentos / mês</Label>
              <Input
                id="meta_fechamentos" type="number" min="0" step="1"
                value={fechamentos} onChange={(e) => setFechamentos(e.target.value)}
                placeholder="Ex.: 3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_receita">Receita / mês (R$)</Label>
              <Input
                id="meta_receita" type="number" min="0" step="0.01"
                value={receita} onChange={(e) => setReceita(e.target.value)}
                placeholder="Ex.: 30000"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter className="flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={handleLimpar} disabled={pending} className="mr-auto">
                Limpar (usar fallback)
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

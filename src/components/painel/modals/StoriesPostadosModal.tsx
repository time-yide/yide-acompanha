"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStoriesPostadasAction } from "@/lib/painel/stories-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientNome: string;
  mesReferencia: string;
  initialPostados: number;
  meta: number;
}

export function StoriesPostadosModal({
  open, onOpenChange, clientId, clientNome, mesReferencia, initialPostados, meta,
}: Props) {
  const router = useRouter();
  const [postados, setPostados] = useState(String(initialPostados));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("mes_referencia", mesReferencia);
    fd.set("quantidade_postada", postados);
    startTransition(async () => {
      const r = await updateStoriesPostadasAction(fd);
      if (r.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Stories atualizados");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Stories · {clientNome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="quantidade_postada">Stories postados no mês</Label>
            <Input
              id="quantidade_postada"
              type="number"
              min={0}
              value={postados}
              onChange={(e) => setPostados(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Meta do mês: {meta}</p>
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadCronogramaAction } from "@/lib/painel/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientNome: string;
  mesReferencia: string;
  initialUrl: string | null;
  initialQuantidade: number;
}

export function CronogramaModal({
  open, onOpenChange, clientId, clientNome, mesReferencia,
  initialUrl, initialQuantidade,
}: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [quantidade, setQuantidade] = useState(String(initialQuantidade));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("mes_referencia", mesReferencia);
    fd.set("cronograma_url", url.trim());
    fd.set("quantidade", quantidade);
    startTransition(async () => {
      const r = await uploadCronogramaAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      toast.success("Cronograma salvo — tarefa de design criada");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Cronograma · {clientNome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="cronograma_url">Link do cronograma (Drive)</Label>
            <Input
              id="cronograma_url"
              type="url"
              placeholder="https://drive.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade de posts</Label>
            <Input
              id="quantidade"
              type="number"
              min={0}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
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

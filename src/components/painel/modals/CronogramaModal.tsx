"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadCronogramaAction, removerCronogramaAction } from "@/lib/painel/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientNome: string;
  mesReferencia: string;
  initialUrl: string | null;
  initialQuantidade: number;
  initialVideos: number;
}

export function CronogramaModal({
  open, onOpenChange, clientId, clientNome, mesReferencia,
  initialUrl, initialQuantidade, initialVideos,
}: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [quantidade, setQuantidade] = useState(String(initialQuantidade));
  const [videos, setVideos] = useState(String(initialVideos));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editando = !!initialUrl;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("mes_referencia", mesReferencia);
    fd.set("cronograma_url", url.trim());
    fd.set("quantidade", quantidade);
    fd.set("quantidade_videos", videos);
    startTransition(async () => {
      const r = await uploadCronogramaAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      toast.success(editando ? "Cronograma atualizado — tarefa do designer sincronizada" : "Cronograma salvo — tarefa de design criada");
      onOpenChange(false);
      router.refresh();
    });
  }

  function onRemover() {
    if (!window.confirm("Excluir o cronograma deste mês? A tarefa criada pro designer também será removida.")) return;
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("mes_referencia", mesReferencia);
    startTransition(async () => {
      const r = await removerCronogramaAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      toast.success("Cronograma removido — tarefa do designer excluída");
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Qtd. de artes (posts)</Label>
              <Input
                id="quantidade"
                type="number"
                min={0}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantidade_videos">Qtd. de vídeos</Label>
              <Input
                id="quantidade_videos"
                type="number"
                min={0}
                value={videos}
                onChange={(e) => setVideos(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            {editando && (
              <Button
                type="button"
                variant="ghost"
                onClick={onRemover}
                disabled={pending}
                className="mr-auto text-destructive hover:text-destructive"
              >
                Excluir cronograma
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : editando ? "Salvar correção" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

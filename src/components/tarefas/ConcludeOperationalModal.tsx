"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { concludeOperationalAction } from "@/lib/tarefas/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTipo: "geral" | "video" | "arte";
  onSuccess: () => void;
}

/**
 * Modal de entrega obrigatório quando responsável (editor/videomaker/
 * designer/audiovisual_chefe) move tarefa pra "Concluído Operacional".
 *
 * Campos:
 * - drive_link: URL do material final (obrigatório)
 * - artes_entregues: quantidade entregue (obrigatório, label dinâmico)
 * - entrega_observacoes: notas livres (opcional)
 */
export function ConcludeOperationalModal({ open, onOpenChange, taskId, taskTipo, onSuccess }: Props) {
  const [driveLink, setDriveLink] = useState("");
  const [qtd, setQtd] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pending, startTransition] = useTransition();

  const qtdLabel = taskTipo === "video" ? "Quantos vídeos foram entregues?" : "Quantas artes foram entregues?";
  const isValid = driveLink.trim().length > 0 && qtd.trim().length > 0 && /^\d+$/.test(qtd) && Number(qtd) >= 1;

  function handleConfirm() {
    if (!isValid) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("drive_link", driveLink);
      fd.set("artes_entregues", qtd);
      if (observacoes.trim()) fd.set("entrega_observacoes", observacoes.trim());
      const r = await concludeOperationalAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Tarefa concluída e materiais registrados");
      setDriveLink("");
      setQtd("");
      setObservacoes("");
      onOpenChange(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir entrega operacional</DialogTitle>
          <DialogDescription>
            Antes de mover pra &quot;Concluído Operacional&quot;, informe onde estão os materiais finais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="drive_link">Link do Drive *</Label>
            <Input
              id="drive_link"
              type="url"
              placeholder="https://drive.google.com/..."
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              disabled={pending}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qtd">{qtdLabel} *</Label>
            <Input
              id="qtd"
              type="number"
              min="1"
              max="999"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações da entrega</Label>
            <Textarea
              id="obs"
              placeholder="Algo importante pro assessor saber? (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={pending}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || pending}>
            {pending ? "Confirmando…" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

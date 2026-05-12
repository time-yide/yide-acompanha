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
  /**
   * Role do atribuído. Usado como tiebreaker quando `taskTipo === "geral"`
   * (típico de tarefas antigas criadas antes da migration que adicionou tipo).
   * Editor/videomaker/audiovisual_chefe → vídeos. Designer → artes.
   */
  atribuidoRole?: string | null;
  /** Pra qual status estamos movendo. Default: "concluida" (concluído operacional). */
  toStatus?: "concluida" | "em_aprovacao";
  onSuccess: () => void;
}

const TITLE: Record<"concluida" | "em_aprovacao", string> = {
  concluida: "Concluir entrega operacional",
  em_aprovacao: "Enviar pra aprovação",
};

const DESCRIPTION: Record<"concluida" | "em_aprovacao", string> = {
  concluida: 'Antes de mover pra "Concluído Operacional", informe onde estão os materiais finais.',
  em_aprovacao: 'Antes de enviar pra aprovação, informe onde estão os materiais pro cliente revisar.',
};

const SUCCESS_MSG: Record<"concluida" | "em_aprovacao", string> = {
  concluida: "Tarefa concluída e materiais registrados",
  em_aprovacao: "Tarefa enviada pra aprovação com materiais registrados",
};

/**
 * Modal de entrega obrigatório quando responsável (editor/videomaker/
 * designer/audiovisual_chefe/coordenador/assessor) move tarefa pra
 * "Concluído Operacional" ou "Aprovação".
 *
 * Campos:
 * - drive_link: URL do material final (obrigatório)
 * - artes_entregues: quantidade entregue (obrigatório, label dinâmico)
 * - entrega_observacoes: notas livres (opcional)
 */
/**
 * Resolve qual label de quantidade usar baseado em (taskTipo, atribuidoRole).
 * Prioridade:
 *  1. taskTipo='video' OU role de vídeo (editor/videomaker/audiovisual_chefe) → "vídeos"
 *  2. taskTipo='arte' OU role='designer' → "artes"
 *  3. fallback (geral, sem role conhecido) → "itens"
 */
function resolveQtdLabel(taskTipo: "geral" | "video" | "arte", atribuidoRole: string | null | undefined): string {
  const isVideoRole =
    atribuidoRole === "editor" ||
    atribuidoRole === "videomaker" ||
    atribuidoRole === "videomaker_mobile" ||
    atribuidoRole === "audiovisual_chefe";
  const isArteRole = atribuidoRole === "designer";

  if (taskTipo === "video" || (taskTipo === "geral" && isVideoRole)) {
    return "Quantos vídeos foram entregues?";
  }
  if (taskTipo === "arte" || (taskTipo === "geral" && isArteRole)) {
    return "Quantas artes foram entregues?";
  }
  return "Quantos itens foram entregues?";
}

export function ConcludeOperationalModal({ open, onOpenChange, taskId, taskTipo, atribuidoRole, toStatus = "concluida", onSuccess }: Props) {
  const [driveLink, setDriveLink] = useState("");
  const [qtd, setQtd] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pending, startTransition] = useTransition();

  const qtdLabel = resolveQtdLabel(taskTipo, atribuidoRole);
  const isValid = driveLink.trim().length > 0 && qtd.trim().length > 0 && /^\d+$/.test(qtd) && Number(qtd) >= 1;

  function handleConfirm() {
    if (!isValid) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("to_status", toStatus);
      fd.set("drive_link", driveLink);
      fd.set("artes_entregues", qtd);
      if (observacoes.trim()) fd.set("entrega_observacoes", observacoes.trim());
      const r = await concludeOperationalAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(SUCCESS_MSG[toStatus]);
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
          <DialogTitle>{TITLE[toStatus]}</DialogTitle>
          <DialogDescription>{DESCRIPTION[toStatus]}</DialogDescription>
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
            {pending ? "Confirmando…" : toStatus === "em_aprovacao" ? "Enviar pra aprovação" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

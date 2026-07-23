"use client";

import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { concludeOperationalAction } from "@/lib/tarefas/actions";
import { isVideoDelivery } from "@/lib/tarefas/delivery-roles";
import { adicionarVideoAction, bunnyDisponivelAction } from "@/lib/review/tarefa-actions";
import { uploadVideoTus } from "@/lib/review/upload-tus";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTipo: "geral" | "video" | "arte";
  /**
   * Role do atribuído. Desempata quando `taskTipo === "geral"`: papéis de vídeo
   * (editor/videomaker/fast_midia/audiovisual_chefe) → sobe pro Frame; designer
   * → artes (link do Drive).
   */
  atribuidoRole?: string | null;
  /** Pra qual status estamos movendo. Default: "concluida". */
  toStatus?: "concluida" | "em_aprovacao";
  onSuccess: () => void;
}

const TITLE: Record<"concluida" | "em_aprovacao", string> = {
  concluida: "Concluir entrega operacional",
  em_aprovacao: "Enviar pra aprovação",
};

const DESCRIPTION: Record<"concluida" | "em_aprovacao", string> = {
  concluida: 'Antes de mover pra "Concluído Operacional", informe onde estão os materiais finais.',
  em_aprovacao: "Antes de enviar pra aprovação, informe onde estão os materiais pro cliente revisar.",
};

const SUCCESS_MSG: Record<"concluida" | "em_aprovacao", string> = {
  concluida: "Tarefa concluída e materiais registrados",
  em_aprovacao: "Tarefa enviada pra aprovação com materiais registrados",
};

/** Label de quantidade pro caminho Drive (arte/itens). */
function resolveQtdLabel(taskTipo: "geral" | "video" | "arte", atribuidoRole: string | null | undefined): string {
  if (isVideoDelivery(taskTipo, atribuidoRole)) return "Quantos vídeos foram entregues?";
  if (taskTipo === "arte" || atribuidoRole === "designer") return "Quantas artes foram entregues?";
  return "Quantos itens foram entregues?";
}

export function ConcludeOperationalModal({ open, onOpenChange, taskId, taskTipo, atribuidoRole, toStatus = "concluida", onSuccess }: Props) {
  const isVideo = isVideoDelivery(taskTipo, atribuidoRole);

  // Caminho Drive (arte/geral, ou vídeo sem Bunny)
  const [driveLink, setDriveLink] = useState("");
  const [qtd, setQtd] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Caminho vídeo (Frame)
  const [bunnyOk, setBunnyOk] = useState<boolean | null>(isVideo ? null : false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [sending, setSending] = useState(false);

  // Ao abrir uma tarefa de vídeo, descobre se o Bunny está disponível.
  // (config global não muda entre aberturas → não precisa resetar pra null)
  useEffect(() => {
    if (!open || !isVideo) return;
    let vivo = true;
    bunnyDisponivelAction().then((ok) => { if (vivo) setBunnyOk(ok); });
    return () => { vivo = false; };
  }, [open, isVideo]);

  const useVideoFlow = isVideo && bunnyOk === true;

  function reset() {
    setDriveLink("");
    setQtd("");
    setObservacoes("");
    setFiles([]);
    setProgress({});
  }

  const driveValid = driveLink.trim().length > 0 && qtd.trim().length > 0 && /^\d+$/.test(qtd) && Number(qtd) >= 1;
  const videoValid = files.length > 0 && !sending;

  async function handleConfirmVideo() {
    if (files.length === 0 || sending) return;
    setSending(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const titulo = files.length > 1 ? `Vídeo ${i + 1}` : "";
        const r = await adicionarVideoAction(taskId, titulo);
        if ("error" in r) throw new Error(r.error);
        await uploadVideoTus(files[i], r.upload, titulo || `Vídeo ${i + 1}`, (pct) =>
          setProgress((p) => ({ ...p, [i]: pct })),
        );
      }
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("to_status", toStatus);
      fd.set("artes_entregues", String(files.length));
      if (observacoes.trim()) fd.set("entrega_observacoes", observacoes.trim());
      const c = await concludeOperationalAction(fd);
      if (c.error) throw new Error(c.error);
      toast.success(SUCCESS_MSG[toStatus]);
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao subir os vídeos");
    } finally {
      setSending(false);
    }
  }

  function handleConfirmDrive() {
    if (!driveValid || sending) return;
    setSending(true);
    (async () => {
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("to_status", toStatus);
      fd.set("drive_link", driveLink);
      fd.set("artes_entregues", qtd);
      if (observacoes.trim()) fd.set("entrega_observacoes", observacoes.trim());
      const r = await concludeOperationalAction(fd);
      setSending(false);
      if (r.error) { toast.error(r.error); return; }
      toast.success(SUCCESS_MSG[toStatus]);
      reset();
      onOpenChange(false);
      onSuccess();
    })();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLE[toStatus]}</DialogTitle>
          <DialogDescription>
            {useVideoFlow ? "Suba o(s) vídeo(s) desta tarefa — vão pro Frame pra revisão interna." : DESCRIPTION[toStatus]}
          </DialogDescription>
        </DialogHeader>

        {isVideo && bunnyOk === null ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
          </div>
        ) : useVideoFlow ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="videos">Vídeos da entrega *</Label>
              <Input
                id="videos"
                type="file"
                accept="video/*"
                multiple
                disabled={sending}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {files.map((f, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      <span>{sending ? `${progress[i] ?? 0}%` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações da entrega</Label>
              <Textarea
                id="obs"
                placeholder="Algo importante pro assessor saber? (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={sending}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="drive_link">Link do Drive *</Label>
              <Input
                id="drive_link"
                type="url"
                placeholder="https://drive.google.com/..."
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                disabled={sending}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qtd">{resolveQtdLabel(taskTipo, atribuidoRole)} *</Label>
              <Input
                id="qtd"
                type="number"
                min="1"
                max="999"
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                disabled={sending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações da entrega</Label>
              <Textarea
                id="obs"
                placeholder="Algo importante pro assessor saber? (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={sending}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={useVideoFlow ? handleConfirmVideo : handleConfirmDrive}
            disabled={(useVideoFlow ? !videoValid : !driveValid) || sending || (isVideo && bunnyOk === null)}
          >
            {sending ? "Enviando…" : toStatus === "em_aprovacao" ? "Enviar pra aprovação" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

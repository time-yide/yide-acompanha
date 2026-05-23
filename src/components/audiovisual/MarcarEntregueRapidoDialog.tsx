"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { markCapturaEntregueRapidoAction } from "@/lib/audiovisual/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  titulo: string;
  /** Pra quando o user quiser preencher form completo em vez do rápido. */
  onPedirFormCompleto?: () => void;
}

/**
 * Modal "Marcar como entregue (rápido)" - usado quando a entrega aconteceu
 * fora do sistema (drive enviado por outro canal, erro no form completo,
 * etc.) e o usuário só quer registrar a entrega pra sair da lista de
 * pendentes.
 *
 * Diferente do CapturaForm (que pede 7 ratings + URL + qtd):
 *  - URL do Drive opcional (placeholder "-" se vazio)
 *  - Sem ratings de feedback
 *  - Observação opcional explicando o porquê
 *
 * Pra adicionar feedback completo depois, basta editar a captação criada.
 */
export function MarcarEntregueRapidoDialog({ open, onOpenChange, eventId, titulo, onPedirFormCompleto }: Props) {
  const router = useRouter();
  const [driveUrl, setDriveUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await markCapturaEntregueRapidoAction({
        event_id: eventId,
        drive_url: driveUrl.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      setDriveUrl("");
      setObservacoes("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Marcar como entregue
          </DialogTitle>
          <DialogDescription>
            Use isso se a entrega já aconteceu fora do sistema (drive enviado por outro canal,
            ou se o formulário completo deu erro). Tira a gravação da lista de pendentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium">{titulo}</p>
            <p className="mt-1 text-muted-foreground">
              Captura será criada sem ratings/feedback. Você pode editar depois pra
              adicionar avaliação completa.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="drive_url_rapido">
              Link do Drive <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
            </Label>
            <Input
              id="drive_url_rapido"
              type="url"
              placeholder="https://drive.google.com/... (cole se tiver)"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs_rapido">
              Observação <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="obs_rapido"
              placeholder="Por que está marcando manualmente? Ex.: 'Drive enviado por WhatsApp', 'erro no form completo'…"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={pending}
              rows={3}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {onPedirFormCompleto && (
            <Button
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                onPedirFormCompleto();
              }}
              disabled={pending}
              className="text-xs text-muted-foreground"
            >
              Prefiro preencher o form completo (com feedback)
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {pending ? "Confirmando…" : "Confirmar entrega"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

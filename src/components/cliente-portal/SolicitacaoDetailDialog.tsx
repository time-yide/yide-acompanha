"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, MessageCircle, CheckCircle2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cancelPortalRequestAction } from "@/lib/portal-requests/actions";
import {
  CATEGORIA_LABEL,
  STATUS_LABEL,
  type RequestRow,
} from "@/lib/portal-requests/schema";

interface Props {
  request: RequestRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_TONE: Record<string, string> = {
  aberta: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  em_andamento: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  concluida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-muted text-muted-foreground",
};

function formatBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SolicitacaoDetailDialog({ request, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    if (!confirm("Cancelar essa solicitação? Não dá pra reabrir depois.")) return;
    startTransition(async () => {
      const r = await cancelPortalRequestAction(request.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Solicitação cancelada");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[request.status]}`}
            >
              {STATUS_LABEL[request.status]}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {CATEGORIA_LABEL[request.categoria]}
            </span>
            {request.prioridade === "urgente" && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                Urgente
              </span>
            )}
          </div>
          <DialogTitle className="mt-1">{request.titulo}</DialogTitle>
          <DialogDescription className="flex items-center gap-1 text-xs">
            <Calendar className="h-3 w-3" />
            Aberta em {formatBR(request.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Mensagem do cliente */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              Sua mensagem
            </div>
            <p className="whitespace-pre-wrap text-sm">{request.descricao}</p>
          </div>

          {/* Resposta do time (se já respondeu) */}
          {request.resposta && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
                <CheckCircle2 className="h-3 w-3" />
                Resposta da equipe Yide
              </div>
              <p className="whitespace-pre-wrap text-sm">{request.resposta}</p>
              {request.resolvido_em && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Respondida em {formatBR(request.resolvido_em)}
                </p>
              )}
            </div>
          )}

          {!request.resposta && request.status === "aberta" && (
            <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-center text-xs text-muted-foreground">
              Aguardando resposta da equipe. Você é notificado assim que tiver retorno.
            </p>
          )}
        </div>

        <DialogFooter>
          {request.status === "aberta" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={pending}
              className="text-destructive hover:text-destructive"
            >
              <X className="mr-1.5 h-4 w-4" />
              {pending ? "Cancelando…" : "Cancelar solicitação"}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

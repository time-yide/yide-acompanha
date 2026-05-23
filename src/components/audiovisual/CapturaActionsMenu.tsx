"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, CheckCircle2, XCircle, CalendarClock, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  markCaptureAsRecordedAction,
  deleteCaptureAction,
  cancelCaptureAction,
  rescheduleCaptureAction,
} from "@/lib/audiovisual/coord-actions";
import { utcIsoToBrtInputValue } from "@/lib/calendario/timezone";

interface Props {
  eventId: string;
  eventTitulo: string;
  eventInicio: string;
  eventFim: string;
  /** "pending" = card de Pendente → mostra "Já gravado"; "scheduled" = Já delegada. */
  variant: "pending" | "scheduled";
}

type ConfirmKind = "recorded" | "cancel" | "delete" | null;

export function CapturaActionsMenu({
  eventId,
  eventTitulo,
  eventInicio,
  eventFim,
  variant,
}: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [inicio, setInicio] = useState(utcIsoToBrtInputValue(eventInicio));
  const [fim, setFim] = useState(utcIsoToBrtInputValue(eventFim));
  const [pending, startTransition] = useTransition();

  function runAction(
    action: (fd: FormData) => Promise<{ success?: boolean; error?: string }>,
    fd: FormData,
    successMsg: string,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const r = await action(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(successMsg);
      onDone?.();
      router.refresh();
    });
  }

  function handleConfirm() {
    const fd = new FormData();
    fd.set("event_id", eventId);
    if (confirm === "recorded") {
      runAction(markCaptureAsRecordedAction, fd, "Captação marcada como gravada", () => setConfirm(null));
    } else if (confirm === "cancel") {
      runAction(cancelCaptureAction, fd, "Captação cancelada", () => setConfirm(null));
    } else if (confirm === "delete") {
      runAction(deleteCaptureAction, fd, "Solicitação excluída", () => setConfirm(null));
    }
  }

  function handleReschedule() {
    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("inicio", inicio);
    fd.set("fim", fim);
    runAction(rescheduleCaptureAction, fd, "Captação reagendada", () => setRescheduleOpen(false));
  }

  const confirmCopy: Record<NonNullable<ConfirmKind>, { title: string; desc: string; btn: string; danger?: boolean }> = {
    recorded: {
      title: "Marcar como já gravada?",
      desc: "Essa captação vai fechar como concluída sem videomaker atribuído. Use quando a gravação já aconteceu mas não foi delegada antes.",
      btn: "Marcar como gravada",
    },
    cancel: {
      title: "Cancelar essa captação?",
      desc: "O slot do videomaker é liberado. O evento fica marcado como cancelado no histórico.",
      btn: "Cancelar captação",
      danger: true,
    },
    delete: {
      title: "Excluir essa solicitação?",
      desc: "A solicitação some do calendário e da fila. Use pra limpar duplicatas ou pedidos errados. Não dá pra desfazer.",
      btn: "Excluir",
      danger: true,
    },
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Mais ações"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {variant === "pending" && (
            <>
              <DropdownMenuItem onClick={() => setConfirm("recorded")} disabled={pending}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                Já foi gravado
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setRescheduleOpen(true)} disabled={pending}>
            <CalendarClock className="mr-2 h-4 w-4" />
            Reagendar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirm("cancel")} disabled={pending}>
            <XCircle className="mr-2 h-4 w-4 text-amber-600" />
            Cancelar gravação
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirm("delete")}
            disabled={pending}
            className="text-rose-600 focus:text-rose-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir solicitação
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirm dialog (recorded / cancel / delete) */}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>{confirmCopy[confirm].title}</DialogTitle>
                <DialogDescription>
                  &ldquo;{eventTitulo}&rdquo; — {confirmCopy[confirm].desc}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirm(null)}
                  disabled={pending}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant={confirmCopy[confirm].danger ? "destructive" : "default"}
                  onClick={handleConfirm}
                  disabled={pending}
                >
                  {pending ? "Processando..." : confirmCopy[confirm].btn}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar captação</DialogTitle>
            <DialogDescription>
              &ldquo;{eventTitulo}&rdquo; vai voltar pra fila de delegação com a nova data. Se já estava delegada, o videomaker é avisado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`reschedule-inicio-${eventId}`}>Novo início</Label>
                <Input
                  id={`reschedule-inicio-${eventId}`}
                  type="datetime-local"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`reschedule-fim-${eventId}`}>Novo fim</Label>
                <Input
                  id={`reschedule-fim-${eventId}`}
                  type="datetime-local"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRescheduleOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleReschedule}
              disabled={pending || !inicio || !fim}
            >
              {pending ? "Reagendando..." : "Reagendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

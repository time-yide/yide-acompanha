"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelCaptureAction } from "@/lib/audiovisual/coord-actions";

interface Props {
  eventId: string;
  titulo: string;
}

export function CancelarCaptacaoButton({ eventId, titulo }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-destructive hover:bg-destructive/15"
        title="Marcar captação como cancelada"
      >
        <X className="h-3 w-3" />
        Cancelar
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar captação?</DialogTitle>
            <DialogDescription>
              {titulo} — a gravação será marcada como cancelada e sai da lista de pendentes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("event_id", eventId);
                startTransition(async () => {
                  const r = await cancelCaptureAction(fd);
                  if (r.error) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Captação cancelada");
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Cancelando…" : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

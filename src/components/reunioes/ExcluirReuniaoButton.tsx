"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { excluirReuniaoAction } from "@/lib/reunioes/gravacao-actions";

interface Props {
  meetingId: string;
  titulo: string;
  /** Pra onde voltar depois de excluir (a reunião aberta some). */
  clientId?: string | null;
}

export function ExcluirReuniaoButton({ meetingId, titulo, clientId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const r = await excluirReuniaoAction(meetingId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Reunião excluída");
      setOpen(false);
      router.push(clientId ? `/clientes/${clientId}/reunioes` : "/reunioes");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        Excluir
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir esta reunião?</DialogTitle>
            <DialogDescription>
              <strong>{titulo}</strong> vai sair da lista e também deixa de
              aparecer no portal do cliente. A gravação é apagada de vez pela
              retenção automática (90 dias).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

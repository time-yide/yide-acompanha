"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deleteTutorialAction } from "@/lib/manual/tutoriais-actions";

interface Props {
  id: string;
  titulo: string;
}

export function DeleteTutorialButton({ id, titulo }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const r = await deleteTutorialAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Tutorial excluído");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3 w-3" />
        Excluir
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir tutorial?</DialogTitle>
            <DialogDescription>
              <strong>{titulo}</strong> vai ser removido pra sempre. Não dá pra desfazer.
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

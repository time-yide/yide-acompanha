"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteClientPortalAccessAction } from "@/lib/painel-cliente/actions";

interface Props {
  userId: string;
  clientNome: string;
  contatoEmail?: string;
}

export function ExcluirAcessoButton({ userId, clientNome, contatoEmail }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    const fd = new FormData();
    fd.set("user_id", userId);
    startTransition(async () => {
      const result = await deleteClientPortalAccessAction(fd);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
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
        Excluir
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir acesso definitivamente?</DialogTitle>
            <DialogDescription>
              {contatoEmail
                ? `O acesso de ${contatoEmail} (${clientNome}) vai ser apagado pra sempre.`
                : `Esse acesso de ${clientNome} vai ser apagado pra sempre.`}{" "}
              Não dá pra desfazer. Use quando criou o acesso errado e não quer
              deixar histórico.
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

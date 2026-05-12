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
import { revokeClientPortalAccessAction } from "@/lib/painel-cliente/actions";

interface Props {
  userId: string;
  clientNome: string;
}

export function RevogarAcessoButton({ userId, clientNome }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRevoke() {
    setError(null);
    const fd = new FormData();
    fd.set("user_id", userId);
    startTransition(async () => {
      const result = await revokeClientPortalAccessAction(fd);
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
        Revogar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revogar acesso</DialogTitle>
            <DialogDescription>
              O acesso de <strong>{clientNome}</strong> ao portal vai ser revogado.
              Ele perde acesso imediatamente. Você pode conceder um novo acesso depois.
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={pending}
            >
              {pending ? "Revogando..." : "Revogar acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

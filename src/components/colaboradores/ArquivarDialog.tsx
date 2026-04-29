"use client";

import { useState, useTransition } from "react";
import { toggleColaboradorAtivoAction } from "@/lib/colaboradores/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Acao = "arquivar" | "desarquivar";

export function ArquivarDialog({
  open,
  onOpenChange,
  userId,
  userNome,
  acao,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userNome: string;
  acao: Acao;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    onOpenChange(false);
    setTimeout(() => setError(null), 200);
  }

  function handleConfirm() {
    setError(null);
    const fd = new FormData();
    fd.set("user_id", userId);
    // ativo == TRUE quando estamos desarquivando, FALSE quando arquivando.
    fd.set("ativo", acao === "desarquivar" ? "true" : "false");
    startTransition(async () => {
      const result = await toggleColaboradorAtivoAction(fd);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // Sucesso: revalidatePath na action força re-render do RSC pai com o
      // novo `ativo`; basta fechar o dialog.
      close();
    });
  }

  const isArquivar = acao === "arquivar";
  const titulo = isArquivar ? `Arquivar ${userNome}?` : `Desarquivar ${userNome}?`;
  const descricao = isArquivar
    ? `Tem certeza que quer arquivar ${userNome}? Ele(a) sai das listagens e dos relatórios mensais. O histórico permanece e você pode desarquivar a qualquer momento.`
    : `Restaurar ${userNome} para as listagens e relatórios.`;
  const confirmLabel = isArquivar
    ? isPending
      ? "Arquivando..."
      : "Arquivar"
    : isPending
      ? "Desarquivando..."
      : "Desarquivar";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={isArquivar ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

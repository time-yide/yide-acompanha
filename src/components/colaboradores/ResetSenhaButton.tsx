"use client";

import { useState, useTransition } from "react";
import { resetColaboradorPasswordAction } from "@/lib/colaboradores/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RevealedPasswordBlock } from "@/components/colaboradores/RevealedPasswordBlock";

type ResetState =
  | { stage: "confirm"; error: string | null }
  | { stage: "success"; password: string };

export function ResetSenhaButton({
  userId,
  userNome,
}: {
  userId: string;
  userNome: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ResetState>({ stage: "confirm", error: null });
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setState({ stage: "confirm", error: null });
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    // Reset depois do fade-out — não estritamente necessário, mas evita que o
    // usuário veja a senha antiga ao reabrir o diálogo.
    setTimeout(() => setState({ stage: "confirm", error: null }), 200);
  }

  function handleConfirm() {
    const fd = new FormData();
    fd.set("user_id", userId);
    startTransition(async () => {
      const result = await resetColaboradorPasswordAction(fd);
      if ("error" in result) {
        setState({ stage: "confirm", error: result.error });
        return;
      }
      setState({ stage: "success", password: result.password });
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={handleOpen}>
        Resetar senha
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {state.stage === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Resetar senha de {userNome}?</DialogTitle>
                <DialogDescription>
                  Tem certeza que quer resetar a senha de {userNome}? A senha atual será invalidada
                  e uma nova será gerada — você precisará enviá-la ao colaborador.
                </DialogDescription>
              </DialogHeader>

              {state.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={isPending}
                >
                  {isPending ? "Resetando..." : "Resetar senha"}
                </Button>
              </DialogFooter>
            </>
          )}

          {state.stage === "success" && (
            <>
              <DialogHeader>
                <DialogTitle>Senha resetada — copie agora</DialogTitle>
                <DialogDescription>
                  ⚠️ Esta senha só aparecerá uma vez. Copie e envie para {userNome} no WhatsApp.
                </DialogDescription>
              </DialogHeader>

              <RevealedPasswordBlock
                password={state.password}
                hint="Se você fechar antes de copiar, será possível gerar uma nova senha clicando em “Resetar senha” novamente."
              />

              <DialogFooter>
                <Button type="button" onClick={handleClose}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RevealedPasswordBlock } from "@/components/colaboradores/RevealedPasswordBlock";
import { CopyLinkButton } from "./CopyLinkButton";
import { resetClientPortalPasswordAction } from "@/lib/painel-cliente/actions";

type ActionState =
  | { success: true; password: string }
  | { error: string }
  | null;

async function actionWrapper(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return resetClientPortalPasswordAction(formData);
}

interface Props {
  userId: string;
  clientNome: string;
  loginUrl: string;
  onClose: () => void;
}

export function ResetPasswordDialog({ userId, clientNome, loginUrl, onClose }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(actionWrapper, null);
  const success = state && "success" in state ? state : null;
  const errorMsg = state && "error" in state ? state.error : null;

  // Atualiza a tabela quando fecha (last_login_at não muda, mas garante consistência)
  useEffect(() => {
    if (success) router.refresh();
  }, [success, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resetar senha do portal</DialogTitle>
          <DialogDescription>
            Vai gerar uma nova senha pro acesso do <strong>{clientNome}</strong>. A
            senha antiga deixa de funcionar.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              ✓ Senha redefinida. Mande o link + a nova senha pelo WhatsApp.
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Link de acesso
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2.5 text-xs font-mono break-all">
                <span className="flex-1">{loginUrl}</span>
                <CopyLinkButton loginUrl={loginUrl} label="Copiar" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nova senha
              </div>
              <RevealedPasswordBlock
                password={success.password}
                hint="⚠️ Esta senha só aparecerá uma vez."
              />
            </div>

            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="user_id" value={userId} />
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Gerando..." : "Gerar nova senha"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

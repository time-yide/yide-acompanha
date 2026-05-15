"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RevealedPasswordBlock } from "@/components/colaboradores/RevealedPasswordBlock";
import { CopyLinkButton } from "./CopyLinkButton";
import { createClientPortalAccessAction } from "@/lib/painel-cliente/actions";

type ActionState =
  | { success: true; password: string }
  | { error: string }
  | null;

async function actionWrapper(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return createClientPortalAccessAction(formData);
}

interface Props {
  clientId: string;
  clientNome: string;
  loginUrl: string;
  onClose: () => void;
}

export function ConcederAcessoDialog({ clientId, clientNome, loginUrl, onClose }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(actionWrapper, null);
  const [verValores, setVerValores] = useState<boolean>(true);
  const success = state && "success" in state ? state : null;
  const errorMsg = state && "error" in state ? state.error : null;

  function handleClose() {
    onClose();
    // Refresh pra atualizar a tabela com o novo acesso
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conceder acesso ao portal</DialogTitle>
          <DialogDescription>
            Crie um acesso pro <strong>{clientNome}</strong> ver o painel do cliente
            dele (contrato, tráfego, pasta etc.).
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              ✓ Acesso criado. Mande os dois pelo WhatsApp:
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                1. Link de acesso
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2.5 text-xs font-mono break-all">
                <span className="flex-1">{loginUrl}</span>
                <CopyLinkButton loginUrl={loginUrl} label="Copiar" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                2. Senha
              </div>
              <RevealedPasswordBlock
                password={success.password}
                hint="⚠️ Esta senha só aparecerá uma vez. Se fechar antes de copiar, gere outra em 'Resetar senha'."
              />
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="client_id" value={clientId} />

            <div className="space-y-2">
              <Label htmlFor="email">Email do contato</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="contato@empresa.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Esse email não pode ser de um colaborador interno.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_contato">Nome do contato</Label>
              <Input
                id="nome_contato"
                name="nome_contato"
                required
                placeholder="João da Silva"
                maxLength={200}
              />
            </div>

            {/* Nível de acesso — ver valores financeiros */}
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <label
                htmlFor="ver_valores"
                className="flex items-start gap-2.5 cursor-pointer"
              >
                <input
                  id="ver_valores"
                  name="ver_valores"
                  type="checkbox"
                  checked={verValores}
                  onChange={(e) => setVerValores(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer"
                  value="1"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium">Pode ver valores financeiros</div>
                  <p className="text-[11px] text-muted-foreground">
                    Marcado: vê valor mensal do contrato e investimento em tráfego.
                    Desmarcado: oculta esses valores (útil pra funcionário do cliente
                    que não deve ter acesso financeiro).
                  </p>
                </div>
              </label>
            </div>

            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Criando..." : "Criar acesso"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

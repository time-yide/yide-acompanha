"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createColaboradorAction } from "@/lib/colaboradores/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ActionState =
  | { success: true; password: string; userId: string }
  | { error: string }
  | null;

async function createColaboradorActionWrapper(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return createColaboradorAction(formData);
}

export function ColaboradorCreateForm({ canSetCommission }: { canSetCommission: boolean }) {
  const [state, formAction, isPending] = useActionState(createColaboradorActionWrapper, null);
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const success = state && "success" in state ? state : null;
  const errorMsg = state && "error" in state ? state.error : null;

  async function handleCopy() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // se a clipboard falhar, deixa o usuário copiar manualmente do bloco visível.
    }
  }

  function handleClose() {
    router.push("/colaboradores");
  }

  return (
    <>
      <form action={formAction} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" name="nome" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Papel</Label>
            <Select name="role" required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adm">ADM</SelectItem>
                <SelectItem value="socio">Sócio</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="coordenador">Coordenador</SelectItem>
                <SelectItem value="assessor">Assessor</SelectItem>
                <SelectItem value="audiovisual_chefe">Audiovisual Chefe</SelectItem>
                <SelectItem value="videomaker">Videomaker</SelectItem>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Produtores audiovisuais (videomaker / designer / editor) recebem apenas fixo —
              os campos de % serão zerados automaticamente.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fixo_mensal">Fixo mensal (R$)</Label>
            <Input id="fixo_mensal" name="fixo_mensal" type="number" step="0.01" min="0" defaultValue="0" />
          </div>
          {canSetCommission && (
            <>
              <div className="space-y-2">
                <Label htmlFor="comissao_percent">% Comissão (assessor / coord)</Label>
                <Input
                  id="comissao_percent"
                  name="comissao_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comissao_primeiro_mes_percent">% sobre 1º mês (comercial)</Label>
                <Input
                  id="comissao_primeiro_mes_percent"
                  name="comissao_primeiro_mes_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue="0"
                />
              </div>
            </>
          )}
        </div>

        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Criando..." : "Criar colaborador"}
        </Button>
      </form>

      <Dialog open={!!success} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Colaborador criado — copie a senha agora</DialogTitle>
            <DialogDescription>
              ⚠️ Esta senha só aparecerá uma vez. Copie e envie pro funcionário no WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {success && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/50 p-3 font-mono text-sm break-all select-all">
                {success.password}
              </div>
              <Button type="button" variant="secondary" onClick={handleCopy} className="w-full">
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" onClick={handleClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createCredentialAction, updateCredentialAction } from "@/lib/credenciais/actions";
import type { CredentialRow } from "@/lib/credenciais/queries";

type ActionResult = { error: string } | { success: true } | undefined;

interface Props {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = criar; preenchido = editar */
  editing?: CredentialRow | null;
}

export function CredentialForm({ clientId, open, onOpenChange, editing }: Props) {
  const isEdit = !!editing;
  const action = isEdit ? updateCredentialAction : createCredentialAction;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => action(_prev, formData),
    undefined,
  );

  // Fecha o modal automaticamente em sucesso
  useEffect(() => {
    if (state && "success" in state) {
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar credencial" : "Nova credencial"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edite os dados. Deixa o campo senha vazio pra manter a atual."
              : "Adiciona uma senha de serviço externo (Facebook, Instagram, etc)."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="client_id" value={clientId} />
          {isEdit && <input type="hidden" name="id" value={editing.id} />}

          <div className="space-y-2">
            <Label htmlFor="service_name">Serviço *</Label>
            <Input
              id="service_name"
              name="service_name"
              placeholder="Ex: Facebook, Instagram, Google Ads"
              defaultValue={editing?.service_name ?? ""}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Usuário / e-mail (opcional)</Label>
            <Input
              id="username"
              name="username"
              placeholder="seu@email.com"
              defaultValue={editing?.username ?? ""}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Senha {isEdit ? "(deixa vazio para manter atual)" : "*"}
            </Label>
            <Input
              id="password"
              name="password"
              type="text"
              placeholder={isEdit ? "Manter senha atual" : "Senha"}
              required={!isEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="2FA, telefone associado, perguntas de segurança, etc"
              defaultValue={editing?.notes ?? ""}
              maxLength={2000}
            />
          </div>

          {state && "error" in state && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

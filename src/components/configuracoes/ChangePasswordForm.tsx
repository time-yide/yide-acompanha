"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changeOwnPasswordAction } from "@/lib/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActionState = { success: true } | { error: string } | null;

async function changeOwnPasswordActionWrapper(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return changeOwnPasswordAction(formData);
}

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    changeOwnPasswordActionWrapper,
    null,
  );

  const success = state && "success" in state ? state : null;
  const errorMsg = state && "error" in state ? state.error : null;

  if (success) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Senha alterada com sucesso.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua nova senha já está ativa.
          </p>
        </div>
        <Link href="/configuracoes" className={buttonVariants()}>
          Voltar para Configurações
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nova senha</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Alterando..." : "Alterar senha"}
      </Button>
    </form>
  );
}

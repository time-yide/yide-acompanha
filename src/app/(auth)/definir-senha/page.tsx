"use client";

import { setPasswordAction } from "@/lib/auth/actions";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

async function setPasswordActionWrapper(
  _state: { error?: string } | undefined,
  formData: FormData
) {
  return setPasswordAction(formData);
}

export default function DefinirSenhaPage() {
  const [state, formAction, isPending] = useActionState(setPasswordActionWrapper, undefined);

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center"><BrandWordmark className="h-12 w-auto" /></div>
      <form action={formAction} className="space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        <h2 className="text-lg font-semibold">Definir nova senha</h2>
        <p className="text-sm text-muted-foreground">Mínimo 8 caracteres.</p>
        {state?.error && (
          <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </div>
  );
}

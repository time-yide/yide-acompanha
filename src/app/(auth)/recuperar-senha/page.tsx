"use client";

import { requestPasswordResetAction } from "@/lib/auth/actions";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useActionState } from "react";

async function requestPasswordResetActionWrapper(
  _state: { error?: string; success?: string } | undefined,
  formData: FormData
) {
  return requestPasswordResetAction(formData);
}

export default function RecuperarSenhaPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetActionWrapper, undefined);

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center"><BrandWordmark className="h-12 w-auto" /></div>
      <form action={formAction} className="space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        <h2 className="text-lg font-semibold">Recuperar senha</h2>
        <p className="text-sm text-muted-foreground">
          Digite seu email e enviaremos um link para redefinir a senha.
        </p>
        {state?.error && (
          <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="rounded bg-green-50 p-3 text-sm text-green-900 dark:bg-green-900/20 dark:text-green-400">
            {state.success}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Enviando..." : "Enviar link"}
        </Button>
        <Link href="/login" className="block text-center text-xs text-muted-foreground hover:text-primary">
          Voltar para login
        </Link>
      </form>
    </div>
  );
}

"use client";

import { signinAction } from "@/lib/auth/actions";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useActionState } from "react";

async function signinActionWrapper(
  _state: { error?: string } | undefined,
  formData: FormData
) {
  return signinAction(formData);
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signinActionWrapper, undefined);

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center gap-2">
        <BrandWordmark className="h-16 w-auto" />
        <p className="text-sm text-muted-foreground">Sistema de acompanhamento</p>
      </div>

      <form action={formAction} className="space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        {state?.error && (
          <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </Button>
        <Link href="/recuperar-senha" className="block text-center text-xs text-muted-foreground hover:text-primary">
          Esqueceu a senha?
        </Link>
      </form>
    </div>
  );
}

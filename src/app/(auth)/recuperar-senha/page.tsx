"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function requestPasswordResetActionWrapper(
  _state: { error?: string; success?: string } | undefined,
  formData: FormData,
) {
  return requestPasswordResetAction(formData);
}

export default function RecuperarSenhaPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetActionWrapper, undefined);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/brand/logo-yide.png"
          alt="Yide Digital"
          width={811}
          height={450}
          priority
          className="h-auto w-36 drop-shadow-[0_0_24px_rgba(61,196,188,0.35)]"
        />
      </div>

      <form
        action={formAction}
        className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">Recuperar senha</h2>
          <p className="mt-1 text-sm text-white/60">
            Digite seu email e enviaremos um link para redefinir a senha.
          </p>
        </div>

        {state?.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {state.success}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-primary/60 focus-visible:ring-primary/30"
            placeholder="seu@email.com"
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full bg-gradient-to-r from-primary to-cyan-400 text-primary-foreground font-semibold shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:brightness-110"
        >
          {isPending ? "Enviando..." : "Enviar link"}
        </Button>

        <Link href="/login" className="block text-center text-xs text-white/50 transition-colors hover:text-primary">
          Voltar para login
        </Link>
      </form>
    </div>
  );
}

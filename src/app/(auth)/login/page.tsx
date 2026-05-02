"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { signinAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function signinActionWrapper(
  _state: { error?: string } | undefined,
  formData: FormData,
) {
  return signinAction(formData);
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signinActionWrapper, undefined);

  return (
    <div className="space-y-8">
      {/* Logo + tagline */}
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/brand/logo-yide.png"
          alt="Yide Digital"
          width={811}
          height={450}
          priority
          className="h-auto w-44 drop-shadow-[0_0_24px_rgba(61,196,188,0.35)]"
        />
        <p className="text-sm text-white/60">Sistema de acompanhamento</p>
      </div>

      {/* Glass card */}
      <form
        action={formAction}
        className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        {state?.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-primary/60 focus-visible:ring-primary/30"
            placeholder="seu@email.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/80">
            Senha
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-primary/60 focus-visible:ring-primary/30"
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full bg-gradient-to-r from-primary to-cyan-400 text-primary-foreground font-semibold shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:brightness-110"
        >
          {isPending ? "Entrando..." : "Entrar"}
        </Button>

        <Link
          href="/recuperar-senha"
          className="block text-center text-xs text-white/50 transition-colors hover:text-primary"
        >
          Esqueceu a senha?
        </Link>
      </form>

      <p className="text-center text-[11px] text-white/30">
        © {new Date().getFullYear()} Yide Digital
      </p>
    </div>
  );
}

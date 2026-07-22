"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle } from "lucide-react";
import { ResponderForm } from "./ResponderForm";
import type { PesquisaLockState } from "@/lib/pesquisas/lock";

interface Props {
  state: PesquisaLockState;
}

export function PesquisaLockGate({ state }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (!state.blocked || !state.pesquisa) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-md sm:p-8">
      <div className="my-auto w-full max-w-2xl space-y-5 rounded-2xl border border-amber-500/40 bg-card p-6 shadow-2xl ring-1 ring-amber-500/20 sm:p-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Pesquisa obrigatória</h2>
            <p className="text-sm text-muted-foreground">
              Responda pra liberar o sistema — leva menos de 3 minutinhos. 💛
            </p>
          </div>
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>Sua opinião importa.</strong>{" "}
            O sistema desbloqueia automaticamente assim que você enviar suas respostas.
          </div>
        </div>

        {/* Formulário (reusa o ResponderForm) */}
        <ResponderForm
          pesquisaId={state.pesquisa.id}
          titulo={state.pesquisa.titulo}
          descricao={state.pesquisa.descricao}
          perguntas={state.perguntas}
          onSubmitted={() => startTransition(() => router.refresh())}
        />
      </div>
    </div>
  );
}

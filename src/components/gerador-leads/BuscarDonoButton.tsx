"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check } from "lucide-react";
import { enriquecerLeadAction } from "@/lib/gerador-leads/enrichment-actions";

interface Props {
  leadId: string;
  /** True quando algum campo já indica enriquecimento concluído. */
  jaEnriquecido: boolean;
  /** True quando ainda está rodando (diagnostico._enriquecendo). */
  enriquecendo: boolean;
}

/**
 * Botão "🔍 Buscar dono" que dispara enriquecimento.
 * Quando está rodando, faz polling de 4s pra atualizar a UI quando terminar.
 */
export function BuscarDonoButton({ leadId, jaEnriquecido, enriquecendo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Polling: enquanto enriquecendo, refresh a cada 4s
  useEffect(() => {
    if (!enriquecendo) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [enriquecendo, router]);

  function buscar() {
    setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    startTransition(async () => {
      const r = await enriquecerLeadAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  if (enriquecendo) {
    return (
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-medium text-amber-700 dark:text-amber-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        Buscando dono...
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={buscar}
        disabled={pending}
        className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium hover:opacity-80 disabled:opacity-50 ${
          jaEnriquecido
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-primary/40 bg-primary/10 text-primary"
        }`}
        title={jaEnriquecido ? "Re-buscar (atualiza dados)" : "Buscar dono via site + Hunter + Instagram + IA"}
      >
        {pending ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Iniciando...
          </>
        ) : jaEnriquecido ? (
          <>
            <Check className="h-3 w-3" />
            Re-buscar
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            Buscar dono
          </>
        )}
      </button>
      {error && (
        <span className="text-[10px] text-destructive ml-1" title={error}>⚠</span>
      )}
    </>
  );
}

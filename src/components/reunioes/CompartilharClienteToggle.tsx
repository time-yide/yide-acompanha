"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleReuniaoVisivelClienteAction } from "@/lib/reunioes/gravacao-actions";

/**
 * Botão opt-in: marca se a reunião aparece no portal do cliente. Só renderiza
 * quando há cliente vinculado (senão não há pra quem mostrar).
 */
export function CompartilharClienteToggle({
  meetingId,
  inicial,
}: {
  meetingId: string;
  inicial: boolean;
}) {
  const router = useRouter();
  const [visivel, setVisivel] = useState(inicial);
  const [pending, start] = useTransition();

  function toggle() {
    const novo = !visivel;
    start(async () => {
      const r = await toggleReuniaoVisivelClienteAction(meetingId, novo);
      if ("error" in r) { toast.error(r.error); return; }
      setVisivel(r.visivel);
      toast.success(r.visivel ? "Reunião visível no portal do cliente." : "Reunião oculta do cliente.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={visivel ? "Visível pro cliente no portal" : "Oculta do cliente — clique pra mostrar"}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        visivel
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : visivel ? (
        <Eye className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
      {visivel ? "Visível ao cliente" : "Mostrar ao cliente"}
    </button>
  );
}

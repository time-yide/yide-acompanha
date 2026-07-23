"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { aceitarTarefaAction, descartarTarefaAction } from "@/lib/reunioes/tarefa-sugerida-actions";

export function ExtractedTaskActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function aceitar() {
    start(async () => {
      const r = await aceitarTarefaAction(id);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Tarefa criada!");
      router.refresh();
    });
  }
  function descartar() {
    start(async () => {
      const r = await descartarTarefaAction(id);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Sugestão descartada.");
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" onClick={aceitar} disabled={pending} title="Aceitar (cria tarefa)" className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button type="button" onClick={descartar} disabled={pending} title="Descartar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import type { Canal, ItemChecklist } from "@/lib/presenca/config";
import { marcarChecklistAction } from "@/lib/presenca/actions";

/** Um item do checklist: checkbox + título + dica. Alterna via server action e refresh. */
export function ChecklistItem({ canal, item, feito }: { canal: Canal; item: ItemChecklist; feito: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function alternar() {
    const fd = new FormData();
    fd.set("canal", canal);
    fd.set("key", item.key);
    fd.set("feito", String(!feito));
    start(async () => {
      const r = await marcarChecklistAction(fd);
      if ("error" in r) { toast.error(r.error); return; }
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pending}
      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          feito
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-input bg-background text-transparent"
        }`}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${feito ? "text-muted-foreground line-through" : "text-foreground"}`}>
          {item.titulo}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{item.dica}</span>
      </span>
    </button>
  );
}

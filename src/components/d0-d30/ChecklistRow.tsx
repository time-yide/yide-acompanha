"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toggleChecklistItemAction } from "@/lib/d0-d30/actions";
import type { ChecklistItem } from "@/lib/d0-d30/template";

interface Props {
  etapaId: string;
  tipo: "fluxo" | "saidas";
  index: number;
  item: ChecklistItem;
  canEdit: boolean;
}

export function ChecklistRow({ etapaId, tipo, index, item, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (!canEdit || pending) return;
    const fd = new FormData();
    fd.set("etapa_id", etapaId);
    fd.set("tipo", tipo);
    fd.set("index", String(index));
    fd.set("done", String(!item.done));
    startTransition(async () => {
      const res = await toggleChecklistItemAction(fd);
      if (res && "error" in res) {
        // Mostra erro inline simples - alert é OK pra MVP
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  const doneAtLabel = item.done_at
    ? new Date(item.done_at).toLocaleDateString("pt-BR", {
        timeZone: "America/Cuiaba",
        day: "2-digit",
        month: "short",
      })
    : null;

  return (
    <li className="flex items-start gap-2.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={!canEdit || pending}
        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all ${
          item.done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-muted-foreground/40 bg-background hover:border-foreground"
        } ${pending ? "opacity-50" : ""} ${!canEdit ? "cursor-not-allowed" : "cursor-pointer"}`}
        aria-label={item.done ? "Desmarcar item" : "Marcar item como feito"}
      >
        {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-tight ${
            item.done ? "text-muted-foreground line-through" : ""
          }`}
        >
          {item.label}
        </p>
        {item.done && doneAtLabel && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            ✓ em {doneAtLabel}
          </p>
        )}
      </div>
    </li>
  );
}

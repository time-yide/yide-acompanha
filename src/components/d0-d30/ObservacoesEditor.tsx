"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { salvarObservacoesAction } from "@/lib/d0-d30/actions";

interface Props {
  etapaId: string;
  initialValue: string;
}

export function ObservacoesEditor({ etapaId, initialValue }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const isDirty = value !== initialValue;

  function handleSave() {
    if (!isDirty || pending) return;
    const fd = new FormData();
    fd.set("etapa_id", etapaId);
    fd.set("observacoes", value);
    startTransition(async () => {
      const res = await salvarObservacoesAction(fd);
      if (res && "error" in res) {
        alert(res.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Observações
        </h3>
        {savedAt && !isDirty && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
            ✓ Salvo
          </span>
        )}
      </div>
      <textarea
        rows={3}
        maxLength={5000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Notas, contexto, decisões tomadas nessa etapa..."
        className="block w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {isDirty && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending ? "Salvando..." : "Salvar observações"}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markEtapaConcluidaAction } from "@/lib/d0-d30/actions";

interface Props {
  etapaId: string;
  disabled: boolean;
  /** D0 do cliente (YYYY-MM-DD) — usado pra limitar o date picker. */
  d0Date?: string;
}

function todayISO(): string {
  // YYYY-MM-DD no fuso local
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function MarcarConcluidaButton({ etapaId, disabled, d0Date }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dataConclusao, setDataConclusao] = useState(todayISO());

  function submit(useDate: boolean) {
    if (disabled || pending) return;
    const fd = new FormData();
    fd.set("etapa_id", etapaId);
    if (useDate) fd.set("data_conclusao", dataConclusao);
    startTransition(async () => {
      const res = await markEtapaConcluidaAction(fd);
      if (res && "error" in res) {
        alert(res.error);
        return;
      }
      setShowDatePicker(false);
      router.refresh();
    });
  }

  if (showDatePicker) {
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <label
            htmlFor={`data-${etapaId}`}
            className="block text-[11px] font-medium text-muted-foreground"
          >
            Data em que foi concluída
          </label>
          <input
            id={`data-${etapaId}`}
            type="date"
            value={dataConclusao}
            min={d0Date}
            max={todayISO()}
            onChange={(e) => setDataConclusao(e.target.value)}
            className="block h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDatePicker(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={() => submit(true)} disabled={pending}>
            {pending ? "Concluindo..." : "Concluir nessa data"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowDatePicker(true)}
        disabled={disabled || pending}
        title="Marcar como concluída com data customizada (pra backdate)"
      >
        <CalendarDays className="mr-1 h-3.5 w-3.5" />
        Com data...
      </Button>
      <Button
        size="sm"
        onClick={() => submit(false)}
        disabled={disabled || pending}
      >
        <CircleCheck className="mr-1 h-3.5 w-3.5" />
        {pending ? "Concluindo..." : "Marcar etapa como concluída"}
      </Button>
    </div>
  );
}

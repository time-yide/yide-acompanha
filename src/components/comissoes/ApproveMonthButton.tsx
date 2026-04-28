"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveMonthAction } from "@/lib/comissoes/actions";

interface Props {
  monthRef: string;
  monthLabel: string;
  count: number;
  hasNegative: boolean;
}

export function ApproveMonthButton({ monthRef, monthLabel, count, hasNegative }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    const fd = new FormData();
    fd.set("mes_referencia", monthRef);
    startTransition(async () => {
      const result = await approveMonthAction(fd);
      if (result && "error" in result) {
        setError(result.error ?? null);
        setConfirming(false);
        return;
      }
      setConfirming(false);
    });
  }

  if (hasNegative) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        Há snapshots com valor total negativo. Corrija antes de aprovar.
      </div>
    );
  }

  return (
    <div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-sm">Aprovar todos os {count} snapshots de {monthLabel}?</span>
          <Button onClick={confirm} disabled={pending}>
            {pending ? "Aprovando..." : "Sim, aprovar"}
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={() => setConfirming(true)}>
          Aprovar mês de {monthLabel}
        </Button>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

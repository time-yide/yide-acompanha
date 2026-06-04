"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { monthLabel } from "@/lib/dashboard/date-utils";

interface Props {
  /** 'YYYY-MM' selecionado. */
  mes: string;
  /** Lista de 'YYYY-MM' (atual primeiro). */
  meses: string[];
  /** 'YYYY-MM' do mês corrente, pra marcar o selo de histórico. */
  mesAtual: string;
}

export function MesSelector({ mes, meses, mesAtual }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value && value !== mesAtual) sp.set("mes", value);
    else sp.delete("mes");
    const qs = sp.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  const histórico = mes !== mesAtual;

  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      {histórico && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
          Fechado · histórico
        </span>
      )}
      <span>Mês:</span>
      <select
        value={mes}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border bg-card px-2 text-xs"
      >
        {meses.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}

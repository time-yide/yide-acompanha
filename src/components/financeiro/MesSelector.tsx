"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function shiftMes(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  return `${MES_LABEL[m - 1]}/${y}`;
}

export function MesSelector({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(mes: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("mes", mes);
    router.push(`/financeiro?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-card">
      <button
        type="button"
        onClick={() => go(shiftMes(current, -1))}
        className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="px-2 text-sm font-medium tabular-nums">{fmt(current)}</span>
      <button
        type="button"
        onClick={() => go(shiftMes(current, 1))}
        className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

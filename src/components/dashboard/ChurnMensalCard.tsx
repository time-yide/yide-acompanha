"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Clock, X } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { Money } from "./HiddenValuesContext";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { ChurnMensalPoint } from "@/lib/dashboard/churn-historico";

interface Props {
  tempoNode: ReactNode;
  helper: ReactNode;
  historico: ChurnMensalPoint[];
}

export function ChurnMensalCard({ tempoNode, helper, historico }: Props) {
  const [open, setOpen] = useState(false);
  // Mais recente no topo.
  const linhas = [...historico].reverse();

  // Esc fecha a modal. Listener no window porque o overlay (div) não recebe foco
  // sozinho — onKeyDown num div não-focável nunca dispararia.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <KpiCard
        label="Tempo médio de casa"
        valor={tempoNode}
        helperText={helper}
        icon={Clock}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="churn-hist-titulo"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border bg-card p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="churn-hist-titulo" className="text-sm font-semibold">Churn mensal — histórico</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2 text-left font-medium">Mês</th>
                      <th className="py-2 text-right font-medium">Churn %</th>
                      <th className="py-2 text-right font-medium">Saíram</th>
                      <th className="py-2 text-right font-medium">R$ perdido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((p, i) => (
                      <tr key={p.mes} className={`border-t ${i === 0 ? "bg-muted/30" : ""}`}>
                        <td className="py-2 text-left">{monthLabel(p.mes)}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {p.churnPct !== null ? `${p.churnPct.toFixed(1)}%` : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums">{p.churns}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          <Money value={p.valorPerdido} noDecimals />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

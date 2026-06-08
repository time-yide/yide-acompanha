"use client";

import { useState } from "react";
import { Phone, MapPin } from "lucide-react";
import type { ProspectoCadencia } from "@/lib/batidas/aggregate";
import { BatidaDrawer } from "./BatidaDrawer";

interface Props {
  prospectos: ProspectoCadencia[];
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  em_cadencia: { label: "Em cadência", cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  convertido: { label: "🎉 Convertido", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  esgotou: { label: "⚠️ Esgotou", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  descartado: { label: "Descartado", cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
};

export function ProspectosCadenciaTable({ prospectos }: Props) {
  const [aberto, setAberto] = useState<ProspectoCadencia | null>(null);

  if (prospectos.length === 0) {
    return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Nenhum prospecto em cadência.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Prospecto</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2">Progresso</th>
              <th className="px-3 py-2">Última batida</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {prospectos.map((p) => {
              const pct = Math.min(100, Math.round((p.totalBatidas / p.meta) * 100));
              const badge = STATUS_BADGE[p.statusCadencia];
              return (
                <tr
                  key={p.key}
                  onClick={() => setAberto(p)}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-medium">{p.nome}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {p.canal === "rua" ? <MapPin className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                      {p.canal === "rua" ? "Rua" : "Ligação"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${p.esgotou ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{p.totalBatidas}/{p.meta}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {p.ultimaBatida ? new Date(p.ultimaBatida).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${badge.cls}`}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aberto && <BatidaDrawer prospecto={aberto} onClose={() => setAberto(null)} />}
    </>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdjustmentModal } from "./AdjustmentModal";

function brl(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const roleLabels: Record<string, string> = {
  adm: "ADM",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

interface Row {
  id: string;
  fixo: number;
  valor_variavel: number;
  ajuste_manual: number;
  valor_total: number;
  status: string;
  papel_naquele_mes: string;
  justificativa_ajuste: string | null;
  profile: { id: string; nome: string; role: string } | null;
}

export function FechamentoTable({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Row | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Colaborador</th>
              <th className="px-3 py-2 text-left font-medium">Papel</th>
              <th className="px-3 py-2 text-right font-medium">Fixo</th>
              <th className="px-3 py-2 text-right font-medium">Variável</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-left font-medium">Justificativa</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.profile?.nome ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {roleLabels[r.papel_naquele_mes] ?? r.papel_naquele_mes}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(Number(r.fixo))}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {brl(Number(r.valor_variavel))}
                  {Number(r.ajuste_manual) !== 0 && (
                    <span className="ml-1 text-[10px] text-amber-600">(ajustado)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{brl(Number(r.valor_total))}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                  {r.justificativa_ajuste ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.status === "pending_approval" && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      Ajustar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <AdjustmentModal
          snapshotId={editing.id}
          currentValor={Number(editing.valor_variavel)}
          collaboratorName={editing.profile?.nome ?? "Colaborador"}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

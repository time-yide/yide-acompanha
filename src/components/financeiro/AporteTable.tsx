"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAporteAction } from "@/lib/financeiro/aportes-actions";
import type { AporteRow } from "@/lib/financeiro/caixa";

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_LABEL: Record<AporteRow["tipo"], string> = {
  capital: "Capital",
  emprestimo: "Empréstimo",
};

function dataLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function AporteTable({ aportes }: { aportes: AporteRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onDelete(id: string) {
    if (!confirm("Excluir este aporte?")) return;
    setError(null);
    setPendingId(id);
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const r = await deleteAporteAction(fd);
      setPendingId(null);
      if (r && "error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  if (aportes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
        Nenhum aporte registrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Data</th>
              <th className="px-3 py-2 text-left font-medium">Sócio</th>
              <th className="px-3 py-2 text-left font-medium">Tipo</th>
              <th className="px-3 py-2 text-left font-medium">Descrição</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {aportes.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="px-3 py-1.5 tabular-nums">{dataLabel(a.data)}</td>
                <td className="px-3 py-1.5">{a.socio_nome}</td>
                <td className="px-3 py-1.5">{TIPO_LABEL[a.tipo]}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{a.descricao ?? "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{BRL(a.valor)}</td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    disabled={pendingId === a.id}
                    className="inline-flex items-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                    aria-label="Excluir aporte"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

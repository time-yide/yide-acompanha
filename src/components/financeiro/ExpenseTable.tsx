"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "./ExpenseForm";
import { CATEGORIA_LABEL } from "@/lib/financeiro/schema";
import { deactivateExpenseAction, deleteExpenseAction } from "@/lib/financeiro/actions";
import type { ExpenseListRow } from "@/lib/financeiro/queries";

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ExpenseTable({ rows }: { rows: ExpenseListRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ExpenseListRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseListRow | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [pending, startTransition] = useTransition();

  function deactivate(id: string) {
    if (!confirm("Marcar como desativada a partir do próximo mês?")) return;
    startTransition(async () => {
      await deactivateExpenseAction(id);
      router.refresh();
    });
  }

  function doDelete() {
    if (!confirmDelete) return;
    if (justificativa.trim().length < 3) return;
    const fd = new FormData();
    fd.set("id", confirmDelete.id);
    fd.set("justificativa", justificativa.trim());
    startTransition(async () => {
      const r = await deleteExpenseAction(fd);
      if (r && "error" in r && r.error) {
        alert(r.error);
        return;
      }
      setConfirmDelete(null);
      setJustificativa("");
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma despesa cadastrada.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Descrição</th>
              <th className="px-3 py-2 text-left font-medium">Categoria</th>
              <th className="px-3 py-2 text-left font-medium">Tipo</th>
              <th className="px-3 py-2 text-left font-medium">Vigência</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/20">
                <td className="px-3 py-2">{r.descricao}</td>
                <td className="px-3 py-2 text-muted-foreground">{CATEGORIA_LABEL[r.categoria]}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.tipo === "fixa" ? "Fixa" : "Avulsa"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.tipo === "avulsa"
                    ? r.mes_referencia
                    : `${r.inicio_mes ?? "—"} → ${r.fim_mes ?? "ativa"}`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{BRL(Number(r.valor))}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(r)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {r.tipo === "fixa" && !r.fim_mes && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => deactivate(r.id)} disabled={pending} title="Desativar">
                        Desativar
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(r)} title="Excluir" className="text-destructive hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Editar despesa</h3>
            <ExpenseForm
              defaults={{
                id: editing.id,
                descricao: editing.descricao,
                categoria: editing.categoria,
                tipo: editing.tipo,
                valor: Number(editing.valor),
                mes_referencia: editing.mes_referencia,
                inicio_mes: editing.inicio_mes,
                fim_mes: editing.fim_mes,
                notas: editing.notas,
              }}
              onClose={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Excluir &ldquo;{confirmDelete.descricao}&rdquo;?</h3>
            <p className="text-xs text-destructive">
              Permanente. Histórico de overrides e DRE de meses passados podem mudar.
            </p>
            <input
              type="text"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Motivo (mín. 3 chars)"
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setConfirmDelete(null); setJustificativa(""); }} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={doDelete} disabled={pending || justificativa.trim().length < 3}>
                {pending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

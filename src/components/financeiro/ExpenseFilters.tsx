"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { EXPENSE_CATEGORIAS, CATEGORIA_LABEL } from "@/lib/financeiro/schema";

export function ExpenseFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "qualquer") sp.delete(key);
    else sp.set(key, value);
    router.push(`/financeiro/despesas?${sp.toString()}`);
  }

  const tipo = params.get("tipo") ?? "qualquer";
  const categoria = params.get("categoria") ?? "qualquer";
  const mes = params.get("mes") ?? "";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <label className="space-y-1">
        <span className="text-[11px] text-muted-foreground">Tipo</span>
        <select value={tipo} onChange={(e) => setParam("tipo", e.target.value)} className="h-8 w-32 rounded-md border bg-card px-2 text-sm">
          <option value="qualquer">Qualquer</option>
          <option value="fixa">Fixa</option>
          <option value="avulsa">Avulsa</option>
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-[11px] text-muted-foreground">Categoria</span>
        <select value={categoria} onChange={(e) => setParam("categoria", e.target.value)} className="h-8 w-44 rounded-md border bg-card px-2 text-sm">
          <option value="qualquer">Qualquer</option>
          {EXPENSE_CATEGORIAS.map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
      </label>

      {tipo === "avulsa" && (
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Mês</span>
          <input
            type="month"
            value={mes}
            onChange={(e) => setParam("mes", e.target.value)}
            className="h-8 w-36 rounded-md border bg-card px-2 text-sm"
          />
        </label>
      )}
    </div>
  );
}

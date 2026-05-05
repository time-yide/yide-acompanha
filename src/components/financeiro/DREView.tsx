"use client";

import { useMemo, useState } from "react";
import { DRELine } from "./DRELine";
import { OverrideDialog } from "./OverrideDialog";
import { type ExpenseCategoria } from "@/lib/financeiro/schema";
import type { DREData, DRELine as DRELineData } from "@/lib/financeiro/queries";

const CATEGORIA_ORDER: ExpenseCategoria[] = [
  "aluguel", "software", "contabilidade", "impostos",
  "marketing_proprio", "equipamento", "pro_labore", "outros",
];

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DREView({ data, prev }: { data: DREData; prev?: DREData | null }) {
  const [editingExpense, setEditingExpense] = useState<{ id: string; descricao: string; valorPadrao: number } | null>(null);

  const despesasPorCat = useMemo(() => {
    const m = new Map<ExpenseCategoria, DRELineData[]>();
    for (const d of data.despesas) {
      const arr = m.get(d.categoria) ?? [];
      arr.push(d);
      m.set(d.categoria, arr);
    }
    return m;
  }, [data.despesas]);

  function delta(curr: number, p: number | undefined): string | null {
    if (p === undefined) return null;
    const d = curr - p;
    if (d === 0) return "—";
    const sign = d > 0 ? "+" : "−";
    const abs = Math.abs(d).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const pct = p !== 0 ? ((d / Math.abs(p)) * 100).toFixed(1) : "—";
    return `${sign}${abs} (${pct}%)`;
  }

  return (
    <div className="space-y-1 rounded-xl border bg-card p-5">
      <DRELine label="Receita Bruta" valor={data.receita_bruta} emphasis />
      {prev && (
        <p className="pl-4 text-xs text-muted-foreground">vs mês anterior: {delta(data.receita_bruta, prev.receita_bruta)}</p>
      )}

      <DRELine label="Custo dos Serviços" valor={data.custo_servicos.total} negative />
      <DRELine label="Comissões" valor={data.custo_servicos.comissoes} indent={2} />
      <DRELine label="Tráfego pago (Google + Meta)" valor={data.custo_servicos.trafego} indent={2} />

      <DRELine label="= Lucro Bruto" valor={data.lucro_bruto} emphasis margemPct={data.margem_bruta_pct} />

      <DRELine label="Despesas Operacionais" valor={data.salarios + data.total_despesas} negative />
      <DRELine label="Salários fixos" valor={data.salarios} indent={2} />

      {CATEGORIA_ORDER.map((cat) => {
        const linhas = despesasPorCat.get(cat) ?? [];
        if (linhas.length === 0) return null;
        return linhas.map((d) => (
          <DRELine
            key={d.expenseId}
            label={d.descricao}
            valor={d.valor}
            indent={2}
            expenseId={d.expenseId}
            overrideAplicado={d.overrideAplicado}
            onEditOverride={(id) => setEditingExpense({ id, descricao: d.descricao, valorPadrao: d.valor })}
          />
        ));
      })}

      <DRELine
        label="= Lucro Operacional"
        valor={data.lucro_operacional}
        emphasis
        margemPct={data.margem_operacional_pct}
      />

      {data.despesas.length === 0 && (
        <p className="pt-2 pl-8 text-xs text-muted-foreground">
          Nenhuma despesa cadastrada — receita está em {BRL(data.receita_bruta)}, comissões em {BRL(data.custo_servicos.comissoes)}.
        </p>
      )}

      {editingExpense && (
        <OverrideDialog
          expenseId={editingExpense.id}
          descricao={editingExpense.descricao}
          mesRef={data.mesRef}
          valorAtual={editingExpense.valorPadrao}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}

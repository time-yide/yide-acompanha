"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DRELine } from "./DRELine";
import { OverrideDialog } from "./OverrideDialog";
import { type ExpenseCategoria } from "@/lib/financeiro/schema";
import type { ColaboradorBreakdown, DREData, DRELine as DRELineData } from "@/lib/financeiro/queries";

const CATEGORIA_ORDER: ExpenseCategoria[] = [
  "aluguel", "software", "contabilidade", "impostos",
  "marketing_proprio", "equipamento", "pro_labore", "outros",
];

const ROLE_LABEL: Record<string, string> = {
  comercial: "Comercial",
  assessor: "Assessor",
  coordenador: "Coordenador",
  audiovisual_chefe: "Audiovisual chefe",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  adm: "ADM",
};

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ExpandKey = "comissoes" | "salarios" | "folha";

export function DREView({ data, prev }: { data: DREData; prev?: DREData | null }) {
  const [editingExpense, setEditingExpense] = useState<{ id: string; descricao: string; valorPadrao: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<ExpandKey>>(new Set());

  // Fallback defensivo: se vier do cache antigo (sem o campo), trata como vazio
  // e a UI degrada pra modo sem breakdown ao invés de crashar.
  const colaboradores: ColaboradorBreakdown[] = data.colaboradores ?? [];

  function toggle(key: ExpandKey) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

      <ExpandableLine
        label="Comissões"
        valor={data.custo_servicos.comissoes}
        expanded={expanded.has("comissoes")}
        onToggle={() => toggle("comissoes")}
        disabled={colaboradores.every((c) => c.comissao === 0)}
      />
      {expanded.has("comissoes") && (
        <BreakdownList
          rows={colaboradores.filter((c) => c.comissao > 0)}
          field="comissao"
          emptyMsg="Nenhum colaborador com comissão neste mês."
        />
      )}

      <DRELine label="Tráfego pago (Google + Meta)" valor={data.custo_servicos.trafego} indent={2} />

      <DRELine label="= Lucro Bruto" valor={data.lucro_bruto} emphasis margemPct={data.margem_bruta_pct} />

      <DRELine label="Despesas Operacionais" valor={data.salarios + data.total_despesas} negative />

      <ExpandableLine
        label="Salários fixos"
        valor={data.salarios}
        expanded={expanded.has("salarios")}
        onToggle={() => toggle("salarios")}
        disabled={colaboradores.every((c) => c.fixo === 0)}
      />
      {expanded.has("salarios") && (
        <BreakdownList
          rows={colaboradores.filter((c) => c.fixo > 0)}
          field="fixo"
          emptyMsg="Nenhum salário fixo cadastrado."
        />
      )}

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

      {/* Folha por pessoa (custo total) */}
      {colaboradores.some((c) => c.total > 0) && (
        <div className="mt-4 border-t pt-3">
          <button
            type="button"
            onClick={() => toggle("folha")}
            className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {expanded.has("folha") ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>Folha por pessoa (fixo + comissão)</span>
            <span className="ml-auto tabular-nums">{BRL(colaboradores.reduce((a, c) => a + c.total, 0))}</span>
          </button>
          {expanded.has("folha") && (
            <FolhaTable rows={colaboradores.filter((c) => c.total > 0)} />
          )}
        </div>
      )}

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

function ExpandableLine({
  label,
  valor,
  expanded,
  onToggle,
  disabled,
}: {
  label: string;
  valor: number;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return <DRELine label={label} valor={valor} indent={2} />;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded py-1.5 pl-8 pr-1 text-xs text-muted-foreground hover:bg-muted/40"
    >
      <span className="flex items-center gap-1.5">
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{label}</span>
      </span>
      <span className="tabular-nums">{BRL(valor)}</span>
    </button>
  );
}

function BreakdownList({
  rows,
  field,
  emptyMsg,
}: {
  rows: ColaboradorBreakdown[];
  field: "fixo" | "comissao";
  emptyMsg: string;
}) {
  if (rows.length === 0) {
    return <p className="pl-12 text-[11px] italic text-muted-foreground">{emptyMsg}</p>;
  }
  return (
    <div className="ml-12 mb-1 space-y-0.5 border-l border-muted pl-3">
      {rows.map((r) => (
        <div key={r.user_id} className="flex items-center justify-between gap-3 py-0.5 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="text-foreground">{r.nome}</span>
            <span className="text-muted-foreground">— {ROLE_LABEL[r.role] ?? r.role}</span>
          </span>
          <span className="tabular-nums text-muted-foreground">{BRL(r[field])}</span>
        </div>
      ))}
    </div>
  );
}

function FolhaTable({ rows }: { rows: ColaboradorBreakdown[] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-md border bg-muted/20">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-1.5 text-left font-medium">Colaborador</th>
            <th className="px-3 py-1.5 text-left font-medium">Função</th>
            <th className="px-3 py-1.5 text-right font-medium">Fixo</th>
            <th className="px-3 py-1.5 text-right font-medium">Comissão</th>
            <th className="px-3 py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id} className="border-t">
              <td className="px-3 py-1.5">{r.nome}</td>
              <td className="px-3 py-1.5 text-muted-foreground">{ROLE_LABEL[r.role] ?? r.role}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{BRL(r.fixo)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{BRL(r.comissao)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{BRL(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

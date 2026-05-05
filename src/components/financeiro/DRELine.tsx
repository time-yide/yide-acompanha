"use client";

import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  valor: number;
  /** Quando true, linha visualmente destacada (Receita, Lucro Bruto, Lucro Operacional) */
  emphasis?: boolean;
  /** Quando true, exibe o valor em negativo visual (despesa) */
  negative?: boolean;
  indent?: 0 | 1 | 2;
  margemPct?: number;
  /** Quando passado, aparece botão de override; chama callback com (id) */
  expenseId?: string;
  overrideAplicado?: boolean;
  onEditOverride?: (id: string) => void;
}

const BRL = (v: number) =>
  (v < 0 ? "-" : "") + Math.abs(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DRELine({
  label, valor, emphasis = false, negative = false, indent = 0, margemPct,
  expenseId, overrideAplicado, onEditOverride,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-1.5 text-sm",
        emphasis && "border-t font-semibold",
        indent === 1 && "pl-4",
        indent === 2 && "pl-8 text-xs text-muted-foreground",
      )}
    >
      <span className="flex items-center gap-2">
        {negative && <span className="text-muted-foreground">(−)</span>}
        <span>{label}</span>
        {overrideAplicado && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">
            override
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className={cn(negative && "text-rose-700 dark:text-rose-400")}>
          {negative ? `−${BRL(valor).replace("-", "")}` : BRL(valor)}
        </span>
        {margemPct !== undefined && (
          <span className="text-xs text-muted-foreground">
            ({margemPct.toFixed(1)}% margem)
          </span>
        )}
        {expenseId && onEditOverride && (
          <button
            type="button"
            onClick={() => onEditOverride(expenseId)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Editar valor neste mês"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
}

"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PagamentoColaborador } from "@/lib/freela-yide/pagamentos";

function fmtData(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function PagamentoColaboradorRow({ c }: { c: PagamentoColaborador }) {
  const [aberto, setAberto] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/30"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{c.nome}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {c.qtd} freela{c.qtd === 1 ? "" : "s"}
            <ChevronDown className={`h-3 w-3 transition-transform ${aberto ? "rotate-180" : ""}`} />
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">R$ {c.total.toLocaleString("pt-BR")}</span>
      </button>
      {aberto && (
        <ul className="space-y-1 border-t bg-muted/20 px-4 py-2">
          {c.itens.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 flex-1 truncate">
                <span className="text-[10px] tabular-nums text-muted-foreground">{fmtData(it.pego_em)} · </span>
                {it.titulo}
                {it.cliente_nome && <span className="text-muted-foreground"> · {it.cliente_nome}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">R$ {it.valor.toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Row {
  id: string;
  client_id: string;
  cliente_nome: string;
  score_final: number;
  cor_final: SatisfactionColor;
}

const corBadge: Record<SatisfactionColor, string> = {
  verde: "bg-green-500/20 text-green-700 dark:text-green-400",
  amarelo: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  vermelho: "bg-red-500/20 text-red-700 dark:text-red-400",
};

type SortKey = "alfabetica" | "score" | "data";

export function OthersTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("score");

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === "alfabetica") return a.cliente_nome.localeCompare(b.cliente_nome, "pt-BR");
    return Number(b.score_final) - Number(a.score_final);
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Ordenar:</span>
        <button
          type="button"
          onClick={() => setSortKey("score")}
          className={sortKey === "score" ? "font-semibold text-primary" : "text-muted-foreground"}
        >
          score
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setSortKey("alfabetica")}
          className={sortKey === "alfabetica" ? "font-semibold text-primary" : "text-muted-foreground"}
        >
          alfabética
        </button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Cliente</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
              <th className="px-3 py-2 text-left font-medium">Cor</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <Link href={`/clientes/${r.client_id}/satisfacao`} className="hover:underline">
                    {r.cliente_nome}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(r.score_final).toFixed(1)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${corBadge[r.cor_final]}`}>
                    {r.cor_final}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

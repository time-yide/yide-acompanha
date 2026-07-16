"use client";

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { FluxoCaixaPonto } from "@/lib/financeiro/caixa";

type Periodo = "6m" | "12m";

interface Props {
  /** Série mensal de fluxo de caixa, mais antigo → mais recente. */
  series: FluxoCaixaPonto[];
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FluxoCaixaChart({ series }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("12m");

  const recorte = periodo === "6m" ? series.slice(-6) : series;

  const pontos = recorte.map((d) => ({
    mes: monthLabel(d.mesRef),
    Entradas: d.entradas,
    Saídas: d.saidas,
    "Saldo acumulado": d.saldoAcumulado,
  }));

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Fluxo de caixa</h2>
        <div className="flex items-center gap-1">
          {(["6m", "12m"] as Periodo[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                (p === periodo
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/20")
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {pontos.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <div className="h-56 w-full sm:h-72" aria-label="Gráfico de fluxo de caixa: entradas, saídas e saldo acumulado por mês">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                yAxisId="valor"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                width={44}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <YAxis
                yAxisId="acum"
                orientation="right"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                width={44}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="valor" dataKey="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="valor" dataKey="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="acum"
                type="monotone"
                dataKey="Saldo acumulado"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface TooltipPayload {
  payload: { mes: string; Entradas: number; Saídas: number; "Saldo acumulado": number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold">{p.mes}</p>
      <p className="text-emerald-600 dark:text-emerald-400">Entradas: {BRL(p.Entradas)}</p>
      <p className="text-rose-600 dark:text-rose-400">Saídas: {BRL(p.Saídas)}</p>
      <p className="text-indigo-500">Saldo acumulado: {BRL(p["Saldo acumulado"])}</p>
    </div>
  );
}

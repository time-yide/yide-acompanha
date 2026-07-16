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
import { ArrowUp, ArrowDown } from "lucide-react";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { DREData } from "@/lib/financeiro/queries";

type Periodo = "6m" | "12m" | "ano";

interface Props {
  /** Série mensal do DRE, mais antigo → mais recente (tipicamente 12 meses). */
  series: DREData[];
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function ChartReceitaCustoLucro({ series }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>("12m");
  const anoAtual = series.length ? series[series.length - 1].mesRef.slice(0, 4) : "";

  const recorte =
    periodo === "6m"
      ? series.slice(-6)
      : periodo === "ano"
        ? series.filter((d) => d.mesRef.slice(0, 4) === anoAtual)
        : series;

  const pontos = recorte.map((d) => ({
    mes: monthLabel(d.mesRef),
    Receita: d.receita_bruta,
    Custo: d.custo_servicos.total + d.salarios + d.total_despesas,
    Lucro: d.lucro_operacional,
    Margem: d.margem_operacional_pct,
  }));

  const n = pontos.length;
  const trend =
    n >= 2
      ? {
          lucro: pontos[n - 1].Lucro - pontos[n - 2].Lucro,
          margem: pontos[n - 1].Margem - pontos[n - 2].Margem,
        }
      : null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Receita × Custo × Lucro</h2>
          {trend && (
            <span className="flex items-center gap-2 text-xs">
              <TrendBadge label="Lucro" delta={trend.lucro} fmt={(x) => `${x >= 0 ? "+" : "−"}${BRL(Math.abs(x))}`} />
              <TrendBadge
                label="Margem"
                delta={trend.margem}
                fmt={(x) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}pp`}
              />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(["6m", "12m", "ano"] as Periodo[]).map((p) => (
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
              {p === "ano" ? anoAtual : p}
            </button>
          ))}
        </div>
      </div>

      {pontos.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <div className="h-56 w-full sm:h-72" aria-label="Gráfico de receita, custo e lucro por mês">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                yAxisId="rs"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                width={44}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                width={38}
                tickFormatter={(v: number) => `${Math.round(v)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="rs" dataKey="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="rs" dataKey="Custo" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="Margem"
                name="Margem %"
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

function TrendBadge({
  label,
  delta,
  fmt,
}: {
  label: string;
  delta: number;
  fmt: (x: number) => string;
}) {
  const up = delta >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 " +
        (up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")
      }
    >
      <Icon className="h-3 w-3" />
      {label} {fmt(delta)}
    </span>
  );
}

interface TooltipPayload {
  payload: { mes: string; Receita: number; Custo: number; Lucro: number; Margem: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold">{p.mes}</p>
      <p className="text-emerald-600 dark:text-emerald-400">Receita: {BRL(p.Receita)}</p>
      <p className="text-rose-600 dark:text-rose-400">Custo: {BRL(p.Custo)}</p>
      <p className="font-medium">Lucro: {BRL(p.Lucro)}</p>
      <p className="text-indigo-500">Margem: {p.Margem.toFixed(1)}%</p>
    </div>
  );
}

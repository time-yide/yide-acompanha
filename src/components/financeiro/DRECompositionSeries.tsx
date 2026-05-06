"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { DREData } from "@/lib/financeiro/queries";

interface Props {
  series: DREData[];
}

const COLORS = {
  lucro: "#10b981",      // emerald-500
  comissoes: "#ef4444",  // red-500
  salarios: "#f97316",   // orange-500
  trafego: "#eab308",    // yellow-500
  despesas: "#94a3b8",   // slate-400
} as const;

const LABELS = {
  comissoes: "Comissões",
  salarios: "Salários",
  trafego: "Tráfego pago",
  despesas: "Outras despesas",
  lucro: "Lucro Operacional",
} as const;

const BRL_SHORT = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}R$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}R$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}R$${abs.toFixed(0)}`;
};

const BRL_FULL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatMesShort(mesRef: string): string {
  const [year, month] = mesRef.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[Number(month) - 1]}/${year.slice(2)}`;
}

export function DRECompositionSeries({ series }: Props) {
  const chartData = useMemo(
    () =>
      series.map((d) => ({
        mes: formatMesShort(d.mesRef),
        mesRef: d.mesRef,
        comissoes: d.custo_servicos.comissoes,
        salarios: d.salarios,
        trafego: d.custo_servicos.trafego,
        despesas: d.total_despesas,
        lucro: d.lucro_operacional,
      })),
    [series],
  );

  const hasAnyData = chartData.some(
    (d) => d.comissoes > 0 || d.salarios > 0 || d.trafego > 0 || d.despesas > 0 || d.lucro !== 0,
  );

  if (!hasAnyData) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Evolução da Composição</h2>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sem dados pra visualizar nesse período.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Evolução da Composição
        </h2>
        <p className="text-xs text-muted-foreground">
          Custos empilhados + Lucro/Prejuízo. Barras abaixo da linha = mês com prejuízo.
        </p>
      </header>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v) => BRL_SHORT(Number(v))}
              width={60}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              formatter={(value, name) => {
                const v = Number(value) || 0;
                const label = LABELS[name as keyof typeof LABELS] ?? String(name);
                return [BRL_FULL(v), label];
              }}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => LABELS[value as keyof typeof LABELS] ?? value}
            />
            {/* Stack "custos": empilhados positivos */}
            <Bar dataKey="comissoes" stackId="custos" fill={COLORS.comissoes} />
            <Bar dataKey="salarios" stackId="custos" fill={COLORS.salarios} />
            <Bar dataKey="trafego" stackId="custos" fill={COLORS.trafego} />
            <Bar dataKey="despesas" stackId="custos" fill={COLORS.despesas} />
            {/* Lucro/Prejuízo: stack próprio. Recharts coloca valores negativos abaixo da linha. */}
            <Bar dataKey="lucro" stackId="resultado" fill={COLORS.lucro} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

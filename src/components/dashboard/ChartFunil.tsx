"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { FunnelStage } from "@/lib/dashboard/comercial-queries";

interface Props {
  data: FunnelStage[];
}

// Cores progressivas — mais saturadas conforme avança no funil
const STAGE_COLORS: Record<string, string> = {
  prospeccao: "#cbd5e1",   // slate-300
  comercial: "#94a3b8",    // slate-400
  contrato: "#5eead4",     // teal-300
  marco_zero: "#3DC4BC",   // brand teal
  ativo: "#0d9488",        // teal-600
};

function formatBRLShort(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v}`;
}

export function ChartFunil({ data }: Props) {
  const chartData = data.map((s) => ({
    label: s.label,
    stage: s.stage,
    count: s.count,
    totalValor: s.totalValor,
  }));

  return (
    <div className="h-64 w-full" aria-label="Gráfico de funil — 5 estágios">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={90} />
          <Tooltip
            formatter={(_value, _name, item) => {
              const payload = item.payload as { count: number; totalValor: number };
              return [`${payload.count} leads · ${formatBRLShort(payload.totalValor)}`, "Total"];
            }}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? "#cbd5e1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

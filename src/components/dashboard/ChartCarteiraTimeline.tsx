"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { TimelinePoint } from "@/lib/dashboard/queries";

interface Props {
  data: TimelinePoint[];
}

function formatBRLShort(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v}`;
}

export function ChartCarteiraTimeline({ data }: Props) {
  const chartData = data.map((p) => ({ mes: monthLabel(p.mes), valor: p.valorTotal }));

  return (
    <div className="h-64 w-full" aria-label="Gráfico de evolução da carteira nos últimos 12 meses">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tickFormatter={formatBRLShort} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={60} />
          <Tooltip
            formatter={(v) => {
              if (typeof v === "number") {
                return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
              }
              return v;
            }}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="#3DC4BC"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

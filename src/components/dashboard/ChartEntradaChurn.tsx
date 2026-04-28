"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { EntradaChurnPoint } from "@/lib/dashboard/queries";

interface Props {
  data: EntradaChurnPoint[];
}

export function ChartEntradaChurn({ data }: Props) {
  const chartData = data.map((p) => ({
    mes: monthLabel(p.mes),
    Entradas: p.entradas,
    Churns: p.churns,
  }));

  return (
    <div className="h-64 w-full" aria-label="Gráfico de entradas vs churns nos últimos 6 meses">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={32} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Churns" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

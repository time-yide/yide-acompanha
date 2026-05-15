"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { GmbTimeSeriesPoint } from "@/lib/clientes/gmb-snapshots";

interface Props {
  data: GmbTimeSeriesPoint[];
}

function formatDateLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/**
 * Gráfico de linha de evolução do GMB: nota (eixo Y1) + reviews (eixo Y2)
 * pelos últimos 90 dias. 2 séries com escalas independentes — nota varia
 * pouco (1 decimal), reviews varia muito (centenas).
 */
export function GmbEvolutionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        Sem histórico ainda — o gráfico vai aparecer conforme o cron diário coletar dados.
        Volte daqui a alguns dias.
      </div>
    );
  }

  const chartData = data.map((p) => ({
    date: formatDateLabel(p.date),
    Nota: p.rating,
    Reviews: p.review_count,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            yAxisId="left"
            domain={[0, 5]}
            tick={{ fontSize: 11 }}
            stroke="#f59e0b"
            width={32}
            label={{ value: "Nota", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#f59e0b" } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--primary))"
            width={42}
            allowDecimals={false}
            label={{ value: "Reviews", angle: 90, position: "insideRight", style: { fontSize: 10 } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="Nota"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="Reviews"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

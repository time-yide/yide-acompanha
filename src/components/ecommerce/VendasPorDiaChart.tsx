"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatarReais } from "@/lib/ecommerce/yideecom-vendas";

interface Props {
  dados: { data: string; faturamento: number; pedidos: number }[];
}

/** Faturamento por dia do período (um dia por barra). */
export function VendasPorDiaChart({ dados }: Props) {
  const pontos = dados.map((d) => ({ ...d, dia: `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}` }));
  return (
    <div className="h-56 w-full sm:h-64" aria-label="Gráfico de faturamento por dia">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
          <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v, _n, item) => [
              `${formatarReais(Number(v))} · ${(item?.payload as { pedidos?: number })?.pedidos ?? 0} pedidos`,
              "Faturamento",
            ]}
          />
          <Bar dataKey="faturamento" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

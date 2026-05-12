"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import type { MetricasGerais } from "@/lib/ligacoes/queries";

interface Props {
  m: MetricasGerais;
}

export function StatusDonut({ m }: Props) {
  const data = [
    { name: "Atendidas", value: m.atendidas, color: "#10b981" },
    { name: "Perdidas", value: m.perdidas, color: "#f59e0b" },
    { name: "Rejeitadas", value: m.rejeitadas, color: "#f43f5e" },
    { name: "Outras", value: m.outras, color: "#64748b" },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-sm">Status das chamadas</h2>
        <p className="text-[11px] text-muted-foreground">Distribuição por resultado</p>
      </div>
      {total === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
          Sem dados no período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                fontSize: 12,
              }}
              formatter={(value) => {
                const n = typeof value === "number" ? value : 0;
                return [`${n} (${((n / total) * 100).toFixed(1)}%)`, ""];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={8}
              verticalAlign="bottom"
              height={36}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

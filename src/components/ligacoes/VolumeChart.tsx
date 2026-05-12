"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import type { VolumePorDia } from "@/lib/ligacoes/queries";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

interface Props {
  data: VolumePorDia[];
}

export function VolumeChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    dataLabel: new Date(`${d.data}T12:00:00`).toLocaleDateString("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "short",
    }),
  }));

  return (
    <Card className="p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-sm">Volume de chamadas</h2>
        <p className="text-[11px] text-muted-foreground">
          Total / atendidas / perdidas por dia
        </p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={formatted} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="atendidasGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="perdidasGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="dataLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              backgroundColor: "var(--background)",
              fontSize: 12,
            }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          <Area
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#totalGradient)"
          />
          <Area
            type="monotone"
            dataKey="atendidas"
            name="Atendidas"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#atendidasGradient)"
          />
          <Area
            type="monotone"
            dataKey="perdidas"
            name="Perdidas"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#perdidasGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

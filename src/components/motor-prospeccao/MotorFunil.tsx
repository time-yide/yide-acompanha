"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { FunilItem } from "@/lib/motor-prospeccao/dashboard-queries";

interface Props {
  data: FunilItem[];
}

export function MotorFunil({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <XAxis type="number" />
        <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

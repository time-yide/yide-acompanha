"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { FunilCompleto } from "@/lib/motor-prospeccao/dashboard-queries";

interface Props {
  data: FunilCompleto;
}

function pct(a: number, b: number): string {
  if (b === 0) return "-";
  return `${Math.round((a / b) * 100)}%`;
}

export function MotorFunil({ data }: Props) {
  const stages = [
    { label: "WPP enviados", valor: data.wppEnviados, color: "hsl(var(--primary))" },
    { label: "Responderam", valor: data.responderam, color: "hsl(var(--primary))" },
    { label: "Ligações feitas", valor: data.ligacoesFeitas, color: "hsl(var(--primary))" },
    { label: "Atenderam", valor: data.ligacoesAtendidas, color: "hsl(var(--primary))" },
    { label: "Reunião agendada", valor: data.reunioesAgendadas, color: "hsl(142 71% 45%)" },
    { label: "Virou cliente", valor: data.viramCliente, color: "hsl(142 71% 45%)" },
  ];

  const allZero = stages.every((s) => s.valor === 0);
  if (allZero) {
    return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={stages} layout="vertical" margin={{ left: 110 }}>
          <XAxis type="number" />
          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
            {stages.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>WPP → Resposta: <strong className="text-foreground">{pct(data.responderam, data.wppEnviados)}</strong></span>
        <span>Ligação → Atendeu: <strong className="text-foreground">{pct(data.ligacoesAtendidas, data.ligacoesFeitas)}</strong></span>
        <span>Resposta → Reunião: <strong className="text-foreground">{pct(data.reunioesAgendadas, data.responderam)}</strong></span>
        <span>Reunião → Cliente: <strong className="text-foreground">{pct(data.viramCliente, data.reunioesAgendadas)}</strong></span>
      </div>
    </div>
  );
}

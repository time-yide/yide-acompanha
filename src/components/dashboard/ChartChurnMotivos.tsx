"use client";

import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { ChurnMotivoPoint } from "@/lib/dashboard/queries";

interface Props {
  data: ChurnMotivoPoint[];
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const ROSE = "#ef4444";
const GREY = "#94a3b8"; // "Sem categoria"

interface TooltipEntry {
  payload: ChurnMotivoPoint;
}

function ChurnTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-foreground">{p.label}</p>
      <p className="text-muted-foreground">{p.quantidade} cliente{p.quantidade === 1 ? "" : "s"}</p>
      <p className="text-rose-600 dark:text-rose-400">{formatBRL(p.valorPerdido)} perdido</p>
    </div>
  );
}

export function ChartChurnMotivos({ data }: Props) {
  // Só mostra buckets com pelo menos 1 churn (esconde os 7 slugs zerados).
  const pontos = data.filter((p) => p.quantidade > 0);

  if (pontos.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center sm:h-64">
        <p className="text-sm text-muted-foreground">Nenhum churn no período.</p>
      </div>
    );
  }

  const totalValor = pontos.reduce((acc, p) => acc + p.valorPerdido, 0);

  return (
    <>
      <div
        className="w-full"
        style={{ height: Math.max(pontos.length * 44, 160) }}
        aria-label="Gráfico de motivos de churn nos últimos 6 meses"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={pontos}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              width={130}
            />
            <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} content={<ChurnTooltip />} />
            <Bar dataKey="quantidade" radius={[0, 4, 4, 0]}>
              {pontos.map((p) => (
                <Cell key={p.motivo ?? "null"} fill={p.motivo === null ? GREY : ROSE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        {formatBRL(totalValor)} perdidos no período · passe o mouse pra ver por motivo
      </p>
    </>
  );
}

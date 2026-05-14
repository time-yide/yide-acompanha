"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { monthLabel } from "@/lib/dashboard/date-utils";
import type { EntradaChurnPoint, EntradaChurnClient } from "@/lib/dashboard/queries";

interface Props {
  data: EntradaChurnPoint[];
}

interface DialogState {
  mes: string;
  mesLabel: string;
  entradas: EntradaChurnClient[];
  churns: EntradaChurnClient[];
}

export function ChartEntradaChurn({ data }: Props) {
  const [drilldown, setDrilldown] = useState<DialogState | null>(null);

  const chartData = data.map((p) => ({
    mes: monthLabel(p.mes),
    mesRaw: p.mes,
    Entradas: p.entradas,
    Churns: p.churns,
  }));

  function handleBarClick(payload: { mesRaw?: string }) {
    if (!payload?.mesRaw) return;
    const point = data.find((p) => p.mes === payload.mesRaw);
    if (!point) return;
    if (point.entradas === 0 && point.churns === 0) return;
    setDrilldown({
      mes: point.mes,
      mesLabel: monthLabel(point.mes),
      entradas: point.entradas_clientes,
      churns: point.churns_clientes,
    });
  }

  return (
    <>
      <div className="h-48 w-full sm:h-64" aria-label="Gráfico de entradas vs churns nos últimos 6 meses">
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
            <Bar
              dataKey="Entradas"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(p) => handleBarClick(p as { mesRaw?: string })}
            />
            <Bar
              dataKey="Churns"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(p) => handleBarClick(p as { mesRaw?: string })}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        Clica numa barra pra ver os clientes
      </p>

      <Dialog open={drilldown !== null} onOpenChange={(open) => { if (!open) setDrilldown(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{drilldown?.mesLabel}</DialogTitle>
            <DialogDescription>
              Clientes que entraram ou saíram nesse mês
            </DialogDescription>
          </DialogHeader>

          {drilldown && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ClienteListSection
                titulo="Entradas"
                icon={ArrowUpRight}
                accent="emerald"
                clientes={drilldown.entradas}
              />
              <ClienteListSection
                titulo="Churns"
                icon={ArrowDownRight}
                accent="rose"
                clientes={drilldown.churns}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SectionProps {
  titulo: string;
  icon: typeof ArrowUpRight;
  accent: "emerald" | "rose";
  clientes: EntradaChurnClient[];
}

function ClienteListSection({ titulo, icon: Icon, accent, clientes }: SectionProps) {
  const styles = accent === "emerald"
    ? { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" }
    : { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" };

  return (
    <div className="rounded-xl border bg-card/40 p-3">
      <header className={`flex items-center gap-1.5 rounded-md ${styles.bg} px-2 py-1 text-xs font-semibold ${styles.text}`}>
        <Icon className="h-3.5 w-3.5" />
        {titulo} ({clientes.length})
      </header>
      {clientes.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nenhum.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clientes/${c.id}`}
                className="group flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/40"
              >
                <span className="truncate">{c.nome}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

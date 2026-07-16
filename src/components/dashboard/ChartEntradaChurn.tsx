"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ArrowUpRight, ArrowDownRight, ExternalLink, Sparkles } from "lucide-react";
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
  data?: EntradaChurnPoint[];
  /** Quando presente, mostra um seletor de ano e exibe os pontos do ano escolhido. */
  porAno?: Record<string, EntradaChurnPoint[]>;
}

interface DialogState {
  mes: string;
  mesLabel: string;
  entradas: EntradaChurnClient[];
  churns: EntradaChurnClient[];
  avulsos: EntradaChurnClient[];
}

export function ChartEntradaChurn({ data, porAno }: Props) {
  const [drilldown, setDrilldown] = useState<DialogState | null>(null);
  const anos = porAno ? Object.keys(porAno).sort() : null;
  const [anoSel, setAnoSel] = useState<string>(anos ? anos[anos.length - 1] : "");

  const pontos = porAno ? (porAno[anoSel] ?? []) : (data ?? []);
  const chartData = pontos.map((p) => ({
    mes: monthLabel(p.mes),
    mesRaw: p.mes,
    Entradas: p.entradas,
    Churns: p.churns,
    Avulsos: p.avulsos,
  }));

  function handleBarClick(payload: { mesRaw?: string }) {
    if (!payload?.mesRaw) return;
    const point = pontos.find((p) => p.mes === payload.mesRaw);
    if (!point) return;
    if (point.entradas === 0 && point.churns === 0 && point.avulsos === 0) return;
    setDrilldown({
      mes: point.mes,
      mesLabel: monthLabel(point.mes),
      entradas: point.entradas_clientes,
      churns: point.churns_clientes,
      avulsos: point.avulsos_clientes,
    });
  }

  return (
    <>
      {anos && (
        <div className="mb-2 flex items-center justify-center gap-1">
          {anos.map((ano) => (
            <button
              key={ano}
              type="button"
              onClick={() => setAnoSel(ano)}
              className={
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                (ano === anoSel
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/20")
              }
            >
              {ano}
            </button>
          ))}
        </div>
      )}
      <div className="h-48 w-full sm:h-64" aria-label="Gráfico de entradas vs churns por mês">
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
            <Bar
              dataKey="Avulsos"
              name="Serviços avulsos"
              fill="#a855f7"
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
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{drilldown?.mesLabel}</DialogTitle>
            <DialogDescription>
              Clientes que entraram ou saíram nesse mês
            </DialogDescription>
          </DialogHeader>

          {drilldown && (
            <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-3">
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
              <ClienteListSection
                titulo="Serviços avulsos"
                icon={Sparkles}
                accent="violet"
                clientes={drilldown.avulsos}
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
  accent: "emerald" | "rose" | "violet";
  clientes: EntradaChurnClient[];
}

const SECTION_STYLES: Record<SectionProps["accent"], { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
};

function ClienteListSection({ titulo, icon: Icon, accent, clientes }: SectionProps) {
  const styles = SECTION_STYLES[accent];

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

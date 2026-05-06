"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { DREData } from "@/lib/financeiro/queries";

interface Props {
  data: DREData;
}

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

const COLORS = {
  lucro: "#10b981",      // emerald-500 — verde
  comissoes: "#ef4444",  // red-500
  salarios: "#f97316",   // orange-500
  trafego: "#eab308",    // yellow-500
  despesas: "#94a3b8",   // slate-400
} as const;

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PCT = (v: number, base: number) =>
  base > 0 ? `${((v / base) * 100).toFixed(1)}%` : "—";

export function DREComposition({ data }: Props) {
  const { slices, total, prejuizo } = useMemo(() => {
    const comissoes = data.custo_servicos.comissoes;
    const trafego = data.custo_servicos.trafego;
    const salarios = data.salarios;
    const despesas = data.total_despesas;
    const lucro = data.lucro_operacional;
    const receita = data.receita_bruta;

    const baseSlices: Slice[] = [];
    if (comissoes > 0) baseSlices.push({ key: "comissoes", label: "Comissões", value: comissoes, color: COLORS.comissoes });
    if (salarios > 0) baseSlices.push({ key: "salarios", label: "Salários fixos", value: salarios, color: COLORS.salarios });
    if (trafego > 0) baseSlices.push({ key: "trafego", label: "Tráfego pago", value: trafego, color: COLORS.trafego });
    if (despesas > 0) baseSlices.push({ key: "despesas", label: "Outras despesas", value: despesas, color: COLORS.despesas });

    if (lucro > 0) {
      // Lucro positivo: ele é uma fatia da receita
      return {
        slices: [{ key: "lucro", label: "Lucro Operacional", value: lucro, color: COLORS.lucro }, ...baseSlices],
        total: receita,
        prejuizo: 0,
      };
    }

    // Prejuízo: só mostra composição dos custos (custos > receita)
    return {
      slices: baseSlices,
      total: comissoes + salarios + trafego + despesas,
      prejuizo: lucro < 0 ? -lucro : 0,
    };
  }, [data]);

  if (data.receita_bruta === 0 && slices.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Composição da Receita</h2>
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sem dados pra visualizar neste mês.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {prejuizo > 0 ? "Composição dos Custos" : "Composição da Receita"}
        </h2>
        {prejuizo > 0 && (
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">
            ⚠ Prejuízo: −{BRL(prejuizo)}
          </span>
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                innerRadius="55%"
                outerRadius="90%"
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, item) => {
                  const v = Number(value) || 0;
                  const slice = item.payload as Slice;
                  return [`${BRL(v)} (${PCT(v, total)})`, slice.label];
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="space-y-1.5">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span>{s.label}</span>
              </span>
              <span className="flex items-baseline gap-2 tabular-nums">
                <span className="font-medium">{BRL(s.value)}</span>
                <span className="text-xs text-muted-foreground">{PCT(s.value, total)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

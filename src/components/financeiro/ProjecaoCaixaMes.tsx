"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { TrendingDown } from "lucide-react";
import type { ProjecaoCaixaMes } from "@/lib/financeiro/projecao";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function mesLabel(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function ProjecaoCaixaMes({ data }: { data: ProjecaoCaixaMes }) {
  const pontos = data.dias.map((d) => ({ dia: `${d.dia}`, Saldo: d.saldo }));
  const negativoNoVale = data.saldoMinimo < 0;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold capitalize">Projeção de caixa — {mesLabel(data.mesRef)}</h2>
        <p className="text-xs text-muted-foreground">
          Timing real do mês: salários saem no dia 5, contas/despesas por volta do dia 15, e o
          recebido dos clientes só entra no último dia. O <strong>vale</strong> é o momento mais
          apertado do giro.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Saldo inicial (estimado)" valor={BRL(data.saldoInicial)} />
        <Kpi
          label={`Vale — dia ${data.diaMinimo}`}
          valor={BRL(data.saldoMinimo)}
          destaque={negativoNoVale ? "rose" : "amber"}
          icon
        />
        <Kpi label="Saldo no fim do mês" valor={BRL(data.saldoFinal)} destaque="emerald" />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="h-56 w-full sm:h-64" aria-label="Projeção do saldo de caixa dia a dia">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pontos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={2} />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                width={48}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                formatter={(v) => [BRL(Number(v)), "Saldo"]}
                labelFormatter={(l) => `Dia ${l}`}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="Saldo" stroke="#6366f1" strokeWidth={2} fill="url(#saldoFill)" />
              <ReferenceDot
                x={`${data.diaMinimo}`}
                y={data.saldoMinimo}
                r={4}
                fill={negativoNoVale ? "#ef4444" : "#f59e0b"}
                stroke="hsl(var(--card))"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {negativoNoVale && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
            <TrendingDown className="h-3.5 w-3.5" />
            O caixa fica <strong>negativo</strong> por volta do dia {data.diaMinimo} — precisa de giro/reserva pra atravessar até o recebimento no fim do mês.
          </p>
        )}
      </div>
    </section>
  );
}

function Kpi({
  label,
  valor,
  destaque,
  icon,
}: {
  label: string;
  valor: string;
  destaque?: "amber" | "rose" | "emerald";
  icon?: boolean;
}) {
  const cor =
    destaque === "rose"
      ? "text-rose-600 dark:text-rose-400"
      : destaque === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : destaque === "emerald"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 flex items-center gap-1 text-lg font-bold tabular-nums ${cor}`}>
        {icon && <TrendingDown className="h-4 w-4" />}
        {valor}
      </p>
    </div>
  );
}

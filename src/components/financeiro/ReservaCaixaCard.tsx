import { Shield } from "lucide-react";
import type { ReservaCaixaData } from "@/lib/financeiro/projecao";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function ReservaCaixaCard({ data }: { data: ReservaCaixaData }) {
  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Shield className="h-3.5 w-3.5" /> Reserva de caixa recomendada
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
            {BRL(data.reservaRecomendada)}
          </p>
          <p className="text-xs text-muted-foreground">
            É o &quot;dinheiro que roda&quot; (capital de giro) pra atravessar o mês e aguentar
            inadimplência/atrasos.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Bridge do mês
          </p>
          <p className="text-base font-semibold tabular-nums">{BRL(data.bridge)}</p>
          <p className="text-[11px] text-muted-foreground">
            custos que saem antes de os clientes pagarem
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Colchão de inadimplência
          </p>
          <p className="text-base font-semibold tabular-nums">{BRL(data.inadimplencia)}</p>
          <p className="text-[11px] text-muted-foreground">valor em aberto hoje</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
        <span className="text-muted-foreground">
          Caixa acumulado estimado: <span className="font-medium tabular-nums text-foreground">{BRL(data.saldoAtual)}</span>
        </span>
        {data.cobre ? (
          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            ✓ cobre a reserva (sobra {BRL(data.faltaOuSobra)})
          </span>
        ) : (
          <span className="rounded-md bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400">
            falta {BRL(Math.abs(data.faltaOuSobra))} pra reserva ideal
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        O &quot;caixa acumulado&quot; é uma estimativa do modelo (não é seu saldo bancário real) —
        use o número da reserva como meta.
      </p>
    </div>
  );
}

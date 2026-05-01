import { Coins } from "lucide-react";
import type { ComissaoPrevista } from "@/lib/dashboard/comissao-prevista";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

export function RemuneracaoCard({ comissao }: { comissao: ComissaoPrevista }) {
  const temBase = comissao.baseCalculo > 0;
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Minha remuneração prevista
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-600 dark:text-sky-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
          Em curso · não fechado ainda
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-0.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fixo</div>
          <div className="text-xl font-semibold tabular-nums">{formatBRL(comissao.fixo)}</div>
          <div className="text-[11px] text-muted-foreground">salário base do mês</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Comissão</div>
          <div className="text-xl font-semibold tabular-nums">{formatBRL(comissao.valorVariavel)}</div>
          <div className="text-[11px] text-muted-foreground">
            {temBase
              ? `${comissao.percentual}% sobre ${formatBRL(comissao.baseCalculo)}`
              : "sem base no mês"}
          </div>
        </div>
        <div className="space-y-0.5 sm:border-l sm:pl-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total previsto</div>
          <div className="text-xl font-bold tabular-nums">{formatBRL(comissao.valor)}</div>
          <div className="text-[11px] text-muted-foreground">pode variar até o fechamento</div>
        </div>
      </div>
    </div>
  );
}

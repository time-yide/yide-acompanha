import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { InadimplenciaData } from "@/lib/financeiro/inadimplencia";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function InadimplenciaCard({ data }: { data: InadimplenciaData }) {
  if (data.indisponivel) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Inadimplência</p>
        <p className="mt-1">
          Controle de pagamentos ainda não ativado. Marque pago/pendente em{" "}
          <Link href="/financeiro/pagamentos" className="underline">
            Pagamentos
          </Link>{" "}
          pra ver a inadimplência aqui.
        </p>
      </div>
    );
  }

  if (data.totalEmAberto <= 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium">Sem inadimplência registrada.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Inadimplência
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
            {BRL(data.totalEmAberto)}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.pctReceita.toFixed(1)}% da receita · {data.qtdClientes} cliente
            {data.qtdClientes !== 1 ? "s" : ""} · {data.qtdMeses} mês/meses em aberto
          </p>
        </div>
        <Link
          href="/financeiro/pagamentos"
          className="rounded-md border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          Ver pagamentos
        </Link>
      </div>

      {data.devedores.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quem mais deve
          </p>
          <ul className="divide-y divide-amber-500/10 text-sm">
            {data.devedores.map((d) => (
              <li key={d.client_id} className="flex items-center justify-between py-1">
                <Link href={`/clientes/${d.client_id}`} className="truncate hover:underline">
                  {d.nome}
                </Link>
                <span className="tabular-nums text-muted-foreground">
                  {BRL(d.valor)}
                  <span className="ml-1 text-[11px]">({d.meses}m)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

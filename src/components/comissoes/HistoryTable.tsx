import Link from "next/link";

function brl(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonth(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${names[Number(month) - 1]}/${year}`;
}

interface Snapshot {
  id: string;
  mes_referencia: string;
  fixo: number;
  valor_variavel: number;
  ajuste_manual: number;
  valor_total: number;
  status: string;
}

export function HistoryTable({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Sem histórico de snapshots. O primeiro será gerado em 1º do próximo mês.
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Mês</th>
            <th className="px-3 py-2 text-right font-medium">Fixo</th>
            <th className="px-3 py-2 text-right font-medium">Variável</th>
            <th className="px-3 py-2 text-right font-medium">Ajuste</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-3 py-2">
                <Link href={`/comissoes/snapshot/${s.id}`} className="hover:underline">
                  {formatMonth(s.mes_referencia)}
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{brl(Number(s.fixo))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{brl(Number(s.valor_variavel))}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(s.ajuste_manual) !== 0 ? brl(Number(s.ajuste_manual)) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{brl(Number(s.valor_total))}</td>
              <td className="px-3 py-2">
                {s.status === "aprovado" ? (
                  <span className="inline-flex rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[11px] text-green-600 dark:text-green-400">
                    Aprovado
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                    Aguardando
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import type { HistoricoFechamento } from "@/lib/prospeccao/queries";

interface Props {
  rows: HistoricoFechamento[];
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function HistoricoFechamentosTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum fechamento nos últimos 12 meses.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Cliente</th>
            <th className="px-3 py-2 text-right font-medium">Valor mensal</th>
            <th className="px-3 py-2 text-left font-medium">Data fechamento</th>
            <th className="px-3 py-2 text-right font-medium">Comissão recebida</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.leadId} className="border-t">
              <td className="px-3 py-2">
                {r.clienteId ? (
                  <Link href={`/clientes/${r.clienteId}`} className="font-medium hover:underline">
                    {r.clienteNome}
                  </Link>
                ) : (
                  <span className="font-medium">{r.clienteNome}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatBRL(r.valorMensal)}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {new Date(r.dataFechamento).toLocaleDateString("pt-BR")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {formatBRL(r.comissaoRecebida)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

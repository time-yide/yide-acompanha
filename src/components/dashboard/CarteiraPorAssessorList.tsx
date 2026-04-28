import type { AssessorCarteira } from "@/lib/dashboard/queries";

interface Props {
  items: AssessorCarteira[];
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function CarteiraPorAssessorList({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem assessores com clientes ativos.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.assessorId} className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{a.assessorNome}</span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span>{a.qtdClientes} {a.qtdClientes === 1 ? "cliente" : "clientes"}</span>
              <span className="font-semibold text-foreground">{formatBRL(a.valorTotal)}</span>
              <span className="w-10 text-right">{a.pctDoTotal.toFixed(0)}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${a.pctDoTotal}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

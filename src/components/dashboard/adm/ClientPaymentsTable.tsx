import { Card } from "@/components/ui/card";
import { TogglePagamentoButton } from "./TogglePagamentoButton";
import type { ClientPaymentRow } from "@/lib/pagamentos/queries";

interface Props {
  rows: ClientPaymentRow[];
  mesReferencia: string;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function ClientPaymentsTable({ rows, mesReferencia }: Props) {
  const pagos = rows.filter((r) => r.status === "pago").length;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Pagamento de clientes</h3>
          <p className="text-xs text-muted-foreground">
            Mês {mesReferencia} · {pagos} de {rows.length} pagos
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sem clientes ativos.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.client_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.client_nome}</p>
                <p className="text-xs text-muted-foreground">{formatBRL(r.valor_mensal)}/mês</p>
              </div>
              <TogglePagamentoButton
                kind="client"
                targetId={r.client_id}
                mesReferencia={mesReferencia}
                currentStatus={r.status}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

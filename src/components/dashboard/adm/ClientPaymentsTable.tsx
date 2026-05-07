import { Card } from "@/components/ui/card";
import { TogglePagamentoButton } from "./TogglePagamentoButton";
import { AjusteRecebimentoButton } from "./AjusteRecebimentoButton";
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
          {rows.map((r) => {
            const temAjuste = r.ajuste_tipo !== null;
            const isGratuidade = r.ajuste_tipo === "gratuidade_total";
            const isDesconto = r.ajuste_tipo === "desconto_parcial";
            const isParceria = r.tipo_relacao !== "comum";

            return (
              <li key={r.client_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.client_nome}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {temAjuste ? (
                      <>
                        <span className="text-muted-foreground line-through">{formatBRL(r.valor_mensal)}</span>
                        <span className="font-semibold text-foreground">{formatBRL(r.valor_efetivo)}</span>
                        <span
                          className={
                            isGratuidade
                              ? "rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium uppercase text-amber-700 dark:text-amber-300"
                              : "rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0 text-[10px] font-medium uppercase text-sky-700 dark:text-sky-300"
                          }
                          title={r.ajuste_motivo ?? undefined}
                        >
                          {isGratuidade ? "Bônus" : `−${formatBRL(r.ajuste_valor_desconto ?? 0)}`}
                        </span>
                      </>
                    ) : isParceria ? (
                      <span className="text-muted-foreground">
                        {formatBRL(0)} · <span className="italic">{r.tipo_relacao}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{formatBRL(r.valor_mensal)}/mês</span>
                    )}
                  </div>
                  {temAjuste && r.ajuste_motivo && isDesconto && (
                    <p className="mt-0.5 truncate text-[10px] italic text-muted-foreground">{r.ajuste_motivo}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Ajuste só faz sentido pra cliente com tipo_relacao=comum */}
                  {!isParceria && (
                    <AjusteRecebimentoButton
                      clientId={r.client_id}
                      mesReferencia={mesReferencia}
                      valorMensal={r.valor_mensal}
                      ajusteAtual={
                        r.ajuste_tipo
                          ? {
                              tipo: r.ajuste_tipo,
                              valor_desconto: r.ajuste_valor_desconto,
                              motivo: r.ajuste_motivo,
                            }
                          : null
                      }
                    />
                  )}
                  <TogglePagamentoButton
                    kind="client"
                    targetId={r.client_id}
                    mesReferencia={mesReferencia}
                    currentStatus={r.status}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

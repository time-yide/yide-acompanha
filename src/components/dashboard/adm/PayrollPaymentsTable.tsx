import { Card } from "@/components/ui/card";
import { TogglePagamentoButton } from "./TogglePagamentoButton";
import type { PayrollRow } from "@/lib/pagamentos/queries";

interface Props {
  rows: PayrollRow[];
  mesReferencia: string;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

const ROLE_LABEL: Record<string, string> = {
  socio: "Sócio",
  adm: "ADM",
  coordenador: "Coordenador",
  assessor: "Assessor",
  comercial: "Comercial",
  designer: "Designer",
  videomaker: "Videomaker",
  editor: "Editor",
  audiovisual_chefe: "Chefe Audiovisual",
};

export function PayrollPaymentsTable({ rows, mesReferencia }: Props) {
  const pagos = rows.filter((r) => r.status === "pago").length;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Pagamento de colaboradores</h3>
          <p className="text-xs text-muted-foreground">
            Mês {mesReferencia} · {pagos} de {rows.length} pagos
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sem colaboradores ativos.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.user_nome}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL[r.user_role] ?? r.user_role} · Fixo {formatBRL(r.fixo_mensal)}
                  {r.comissao_mes > 0 && <> · Comissão {formatBRL(r.comissao_mes)}</>}
                  {" · Total "}<strong className="text-foreground">{formatBRL(r.total)}</strong>
                </p>
              </div>
              <TogglePagamentoButton
                kind="payroll"
                targetId={r.user_id}
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

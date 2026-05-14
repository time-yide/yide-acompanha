import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { DeleteClienteButton } from "./DeleteClienteButton";
import { AjusteMensalDialog } from "./AjusteMensalDialog";
import type { MonthlyAdjustment } from "@/lib/clientes/ajustes";

interface Props {
  cliente: {
    id: string;
    nome: string;
    status: string;
    valor_mensal: number;
    data_entrada: string;
    tipo_relacao?: string | null;
    assessor?: { nome: string } | null;
    coordenador?: { nome: string } | null;
  };
  canSeeMoney: boolean;
  canDelete: boolean;
  canLancarAjuste?: boolean;
  ajusteMes?: MonthlyAdjustment | null;
}

function formatMonths(dataEntrada: string) {
  const start = new Date(dataEntrada);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return months <= 0 ? "menos de 1 mês" : `${months} meses`;
}

export function ClienteHeader({ cliente, canSeeMoney, canDelete, canLancarAjuste, ajusteMes }: Props) {
  const tipoRelacao = cliente.tipo_relacao ?? "comum";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">{cliente.nome}</h1>
          <StatusBadge status={cliente.status} />
          {tipoRelacao !== "comum" && (
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                tipoRelacao === "parceria"
                  ? "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
            >
              {tipoRelacao === "parceria" ? "Parceria" : "Permuta"}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Cliente há {formatMonths(cliente.data_entrada)}
          {cliente.assessor?.nome && ` · Assessor: ${cliente.assessor.nome}`}
          {cliente.coordenador?.nome && ` · Coord: ${cliente.coordenador.nome}`}
        </p>
        {ajusteMes && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            {ajusteMes.tipo === "gratuidade_total"
              ? "Mês grátis"
              : `Desconto R$ ${Number(ajusteMes.valor_desconto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            {" · "}{ajusteMes.motivo}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {canSeeMoney && (
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor mensal</div>
            <div className="text-xl font-bold tabular-nums">
              {Number(cliente.valor_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
        )}
        {canLancarAjuste && tipoRelacao === "comum" && (
          <AjusteMensalDialog clienteId={cliente.id} ajusteAtual={ajusteMes} />
        )}
        {canDelete && (
          <DeleteClienteButton clienteId={cliente.id} clienteNome={cliente.nome} />
        )}
      </div>
    </header>
  );
}

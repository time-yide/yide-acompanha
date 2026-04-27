import { StatusBadge } from "./StatusBadge";

interface Props {
  cliente: {
    nome: string;
    status: string;
    valor_mensal: number;
    data_entrada: string;
    assessor?: { nome: string } | null;
    coordenador?: { nome: string } | null;
  };
  canSeeMoney: boolean;
}

function formatMonths(dataEntrada: string) {
  const start = new Date(dataEntrada);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return months <= 0 ? "menos de 1 mês" : `${months} meses`;
}

export function ClienteHeader({ cliente, canSeeMoney }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">{cliente.nome}</h1>
          <StatusBadge status={cliente.status} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Cliente há {formatMonths(cliente.data_entrada)}
          {cliente.assessor?.nome && ` · Assessor: ${cliente.assessor.nome}`}
          {cliente.coordenador?.nome && ` · Coord: ${cliente.coordenador.nome}`}
        </p>
      </div>
      {canSeeMoney && (
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor mensal</div>
          <div className="text-xl font-bold tabular-nums">
            {Number(cliente.valor_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      )}
    </header>
  );
}

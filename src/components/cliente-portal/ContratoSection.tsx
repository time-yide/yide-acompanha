import { FileText } from "lucide-react";

interface Props {
  cliente: {
    valor_mensal: number;
    servico_contratado: string | null;
    tipo_pacote: string | null;
    modalidade: string | null;
  };
  assessor: { nome: string } | null;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_PACOTE_LABEL: Record<string, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  premium: "Premium",
  customizado: "Customizado",
};

export function ContratoSection({ cliente, assessor }: Props) {
  const pacote = cliente.tipo_pacote
    ? TIPO_PACOTE_LABEL[cliente.tipo_pacote] ?? cliente.tipo_pacote
    : "—";
  const modalidade = cliente.modalidade
    ? cliente.modalidade === "pontual" ? "Pontual" : "Mensal"
    : "—";

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <header className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Seu contrato
        </h2>
      </header>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Serviço</dt>
          <dd className="mt-0.5 text-sm font-medium">
            {cliente.servico_contratado ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Modalidade</dt>
          <dd className="mt-0.5 text-sm font-medium">{modalidade}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Pacote</dt>
          <dd className="mt-0.5 text-sm font-medium">{pacote}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            Valor mensal
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums">
            {BRL(Number(cliente.valor_mensal) || 0)}
          </dd>
        </div>
        {assessor && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Seu assessor
            </dt>
            <dd className="mt-0.5 text-sm font-medium">{assessor.nome}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

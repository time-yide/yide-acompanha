import { FileText, Briefcase, Calendar, User, DollarSign } from "lucide-react";

interface Props {
  cliente: {
    valor_mensal: number;
    servico_contratado: string | null;
    modalidade: string | null;
  };
  assessor: { nome: string } | null;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ContratoSection({ cliente, assessor }: Props) {
  const modalidade = cliente.modalidade
    ? cliente.modalidade === "pontual"
      ? "Pontual"
      : "Mensal"
    : "—";
  const valor = Number(cliente.valor_mensal) || 0;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Seu contrato</h2>
              <p className="text-xs text-muted-foreground">Resumo do plano</p>
            </div>
          </div>

          {valor > 0 && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Valor mensal
              </div>
              <div className="text-xl font-bold tabular-nums text-primary sm:text-2xl">
                {BRL(valor)}
              </div>
            </div>
          )}
        </header>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoCard
            icon={Briefcase}
            label="Serviço"
            value={cliente.servico_contratado ?? "—"}
          />
          <InfoCard icon={Calendar} label="Modalidade" value={modalidade} />
          {valor > 0 && cliente.modalidade !== "pontual" && (
            <InfoCard
              icon={DollarSign}
              label="Valor mensal"
              value={BRL(valor)}
              highlight
            />
          )}
          {assessor && (
            <InfoCard
              icon={User}
              label="Seu assessor"
              value={assessor.nome}
              span={2}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  highlight,
  span,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
  span?: 2;
}) {
  return (
    <div
      className={`rounded-xl border bg-background/40 p-3 ${
        span === 2 ? "sm:col-span-2" : ""
      } ${highlight ? "border-primary/30 bg-primary/5" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-semibold ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

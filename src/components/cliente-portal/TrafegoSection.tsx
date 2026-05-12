import { Megaphone } from "lucide-react";

interface Props {
  google: number | null;
  meta: number | null;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function TrafegoSection({ google, meta }: Props) {
  const g = Number(google) || 0;
  const m = Number(meta) || 0;
  const total = g + m;
  const semTrafego = g === 0 && m === 0;

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <header className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tráfego pago
        </h2>
      </header>

      {semTrafego ? (
        <p className="text-sm text-muted-foreground">
          Sem investimento de tráfego registrado no momento.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card label="Google" valor={g} accent="amber" />
          <Card label="Meta" valor={m} accent="sky" />
          <Card label="Total" valor={total} accent="primary" emphasis />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Valores investidos por mês — definidos no seu plano.
      </p>
    </section>
  );

  function Card({
    label,
    valor,
    accent,
    emphasis,
  }: {
    label: string;
    valor: number;
    accent: "amber" | "sky" | "primary";
    emphasis?: boolean;
  }) {
    const ring =
      accent === "amber"
        ? "ring-amber-500/30 bg-amber-500/5"
        : accent === "sky"
        ? "ring-sky-500/30 bg-sky-500/5"
        : "ring-primary/40 bg-primary/5";
    return (
      <div className={`rounded-lg ring-1 p-3 ${ring}`}>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-1 tabular-nums ${
            emphasis ? "text-xl font-bold" : "text-lg font-semibold"
          }`}
        >
          {BRL(valor)}
        </div>
      </div>
    );
  }
}

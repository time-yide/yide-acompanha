import { Megaphone, Sparkles } from "lucide-react";

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
  const semTrafego = total === 0;

  if (semTrafego) {
    return (
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-amber-500/10 via-card to-card p-6 sm:p-8">
          <header className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Tráfego pago</h2>
              <p className="text-xs text-muted-foreground">Google Ads + Meta Ads</p>
            </div>
          </header>

          <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-500" />
            <p>
              Sem investimento em tráfego registrado ainda. Quando começarmos
              campanhas pra vocês, os valores aparecem aqui.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Com dados — mostra o valor total grande no topo + proporção visual + cards.
  const pctGoogle = total > 0 ? (g / total) * 100 : 50;
  const pctMeta = 100 - pctGoogle;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Tráfego pago</h2>
              <p className="text-xs text-muted-foreground">Investimento mensal</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total
            </div>
            <div className="text-2xl font-bold tabular-nums sm:text-3xl">
              {BRL(total)}
            </div>
          </div>
        </header>

        {/* Barra de proporção */}
        <div className="mt-6 space-y-1.5">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
              style={{ width: `${pctGoogle}%` }}
              title={`Google: ${pctGoogle.toFixed(0)}%`}
            />
            <div
              className="bg-gradient-to-r from-sky-400 to-sky-500 transition-all"
              style={{ width: `${pctMeta}%` }}
              title={`Meta: ${pctMeta.toFixed(0)}%`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Google {pctGoogle.toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Meta {pctMeta.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Cards detalhados */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PlatformCard label="Google Ads" valor={g} accent="amber" />
          <PlatformCard label="Meta Ads" valor={m} accent="sky" />
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Valores investidos por mês, definidos no seu plano.
        </p>
      </div>
    </section>
  );
}

function PlatformCard({
  label,
  valor,
  accent,
}: {
  label: string;
  valor: number;
  accent: "amber" | "sky";
}) {
  const accentStyle =
    accent === "amber"
      ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5"
      : "border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-sky-500/5";

  return (
    <div className={`rounded-xl border p-4 ${accentStyle}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{BRL(valor)}</div>
    </div>
  );
}

import type { FunilStep } from "@/lib/onboarding-relatorios/queries";

interface Props {
  funil: FunilStep[];
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatValor(step: FunilStep): string {
  return step.formato === "moeda" ? BRL(step.valor) : step.valor.toLocaleString("pt-BR");
}

function computeWidths(funil: FunilStep[]): number[] {
  const max = Math.max(...funil.map((s) => s.valor), 1);
  // Largura proporcional, com floor monotônico (forma de funil) e mínimo 10%.
  let prev = 100;
  return funil.map((s) => {
    const raw = (s.valor / max) * 100;
    const capped = Math.min(raw, prev);
    const final = Math.max(capped, 10);
    prev = final;
    return final;
  });
}

function conversao(curr: number, prev: number): string {
  if (prev === 0) return "";
  return `${((curr / prev) * 100).toFixed(1)}%`;
}

export function FunilConversao({ funil }: Props) {
  const widths = computeWidths(funil);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-[0_0_40px_-20px] shadow-primary/20 sm:p-8">
      <header className="mb-6">
        <h2 className="text-base font-semibold tracking-tight">Funil de conversão</h2>
        <p className="text-xs text-muted-foreground">
          Do investimento em tráfego até o valor em vendas no período
        </p>
      </header>

      <div className="space-y-2">
        {funil.map((step, i) => {
          const prev = i > 0 ? funil[i - 1].valor : null;
          return (
            <div key={step.key} className="space-y-1">
              {prev !== null && (
                <div className="flex justify-center">
                  <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    ↓ {conversao(step.valor, prev)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex flex-1 items-center gap-3">
                  <div className="min-w-[160px] text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {step.label}
                    {step.placeholder && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full bg-muted/30 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-muted-foreground/70"
                        title="Fonte de dados em construção"
                      >
                        Em breve
                      </span>
                    )}
                  </div>
                  <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-muted/30">
                    <div
                      className="animate-funil-grow h-full rounded-lg bg-gradient-to-r from-primary via-primary/85 to-primary/40 shadow-[0_0_24px_-6px] shadow-primary/50"
                      style={{
                        width: `${widths[i]}%`,
                        animationDelay: `${i * 80}ms`,
                      }}
                    />
                  </div>
                </div>
                <div className="min-w-[140px] text-right text-base font-bold tabular-nums">
                  {formatValor(step)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

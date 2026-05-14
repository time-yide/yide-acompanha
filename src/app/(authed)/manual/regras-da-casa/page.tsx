import { ScrollText, Rocket, Construction } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { D0_D30_TEMPLATE } from "@/lib/d0-d30/template";
import { ManualBreadcrumb } from "@/components/manual/ManualBreadcrumb";

export default async function RegrasDaCasaPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <ManualBreadcrumb current="Regras da casa" />

      <header className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ScrollText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regras da casa</h1>
          <p className="text-sm text-muted-foreground">
            Como a Yide opera no dia a dia
          </p>
        </div>
      </header>

      {/* Placeholder pras regras gerais — Yasmin preenche depois. */}
      <section className="rounded-2xl border border-dashed bg-muted/10 p-6">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">Princípios gerais</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Construction className="h-3 w-3" />
            Em construção
          </span>
        </header>
        <p className="mt-3 text-sm text-muted-foreground">
          Yasmin vai escrever as regras gerais aqui: horário, comunicação,
          padrões de qualidade, processo de decisão, etc.
        </p>
      </section>

      {/* Jornada do cliente (D0 → D30) — vem do template canônico. */}
      <section className="rounded-2xl border bg-card p-6 sm:p-8">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Jornada do cliente (D0 → D30)
            </h2>
            <p className="text-xs text-muted-foreground">
              {D0_D30_TEMPLATE.length} etapas do primeiro mês de cliente: quem faz o quê e o que precisa entregar.
            </p>
          </div>
        </header>

        <ol className="mt-6 space-y-4">
          {D0_D30_TEMPLATE.map((etapa) => {
            const diaLabel =
              etapa.dia_inicio_previsto === null || etapa.dia_fim_previsto === null
                ? "Contínua"
                : etapa.dia_inicio_previsto === etapa.dia_fim_previsto
                ? `D${etapa.dia_inicio_previsto}`
                : `D${etapa.dia_inicio_previsto}–D${etapa.dia_fim_previsto}`;
            return (
              <li
                key={etapa.codigo}
                className="rounded-xl border bg-background/40 p-4 transition-colors hover:border-primary/30"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary">
                      {etapa.numero}
                    </span>
                    <h3 className="text-sm font-semibold">{etapa.nome}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-muted/40 px-2 py-0.5 font-mono">{diaLabel}</span>
                    <span>·</span>
                    <span>
                      {etapa.responsaveis
                        .map((r) =>
                          r === "comercial"
                            ? "Comercial"
                            : r === "adm"
                            ? "ADM"
                            : r === "coordenador"
                            ? "Coordenador"
                            : r === "assessor"
                            ? "Assessor"
                            : "Time operacional",
                        )
                        .join(" · ")}
                    </span>
                  </div>
                </header>

                {etapa.fluxo.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fluxo</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-foreground/90">
                      {etapa.fluxo.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-primary/60" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {etapa.saidas.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Saídas obrigatórias</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-foreground/90">
                      {etapa.saidas.map((s) => (
                        <li key={s} className="flex items-start gap-2">
                          <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-emerald-500/70" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

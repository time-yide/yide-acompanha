import { ShieldCheck, RefreshCw, Palette } from "lucide-react";
import { pctAprovacao, type AprovacaoRow, type RetrabalhoRow } from "@/lib/produtividade/qualidade-setor";

function corAprovacao(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 50) return "text-amber-500";
  return "text-rose-500";
}

function corRetrabalho(n: number): string {
  if (n === 0) return "text-emerald-500";
  if (n <= 2) return "text-amber-500";
  return "text-rose-500";
}

function Bloco({ titulo, icon: Icon, children }: { titulo: string; icon: typeof RefreshCw; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

export function QualidadeSetorSection({ assessoria, design }: { assessoria: RetrabalhoRow[]; design: AprovacaoRow[] }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Qualidade &amp; retrabalho</h2>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Bloco titulo="Assessoria · retrabalho" icon={RefreshCw}>
          {assessoria.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum ajuste solicitado no período.</p>
          ) : (
            <ul className="divide-y">
              {assessoria.map((p) => (
                <li key={p.user_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="truncate font-medium">{p.nome}</span>
                  <span className={`shrink-0 font-semibold tabular-nums ${corRetrabalho(p.ajustes)}`}>
                    {p.ajustes} ajuste{p.ajustes === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="px-4 py-2 text-[10px] text-muted-foreground">Quantas vezes a tarefa voltou pra ajuste (menos = melhor).</p>
        </Bloco>

        <Bloco titulo="Design · aprovação" icon={Palette}>
          {design.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma arte criada no período.</p>
          ) : (
            <ul className="divide-y">
              {design.map((p) => {
                const pct = pctAprovacao(p.aprovadas, p.criadas);
                return (
                  <li key={p.user_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="truncate font-medium">{p.nome}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className={`font-semibold ${corAprovacao(pct)}`}>{pct === null ? "—" : `${pct}%`}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground">({p.aprovadas}/{p.criadas})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="px-4 py-2 text-[10px] text-muted-foreground">Artes aprovadas sobre criadas no período (mais = melhor).</p>
        </Bloco>
      </div>
    </section>
  );
}

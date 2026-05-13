import { BarChart3, Construction, Sparkles } from "lucide-react";

/**
 * Placeholder visual da seção Relatórios. Versão futura vai permitir
 * emitir/baixar relatórios direto pelo portal (performance, engajamento,
 * conversões) — espelhando o que vai ser construído dentro do sistema
 * pra equipe interna gerar.
 */
export function RelatoriosSection() {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Relatórios</h2>
              <p className="text-xs text-muted-foreground">Performance da sua conta</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Construction className="h-3 w-3" />
            Em breve
          </span>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <ComingSoonItem text="Performance de campanhas (Google + Meta)" />
          <ComingSoonItem text="Engajamento das redes" />
          <ComingSoonItem text="Conversões e leads gerados" />
          <ComingSoonItem text="Download em PDF mensal" />
        </div>
      </div>
    </section>
  );
}

function ComingSoonItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-primary/20 bg-primary/5 p-3">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

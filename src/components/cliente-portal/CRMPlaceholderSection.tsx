import { Database, Construction, Sparkles } from "lucide-react";

/**
 * Placeholder visual da seção CRM. Fase 1 só mostra o card sem dados;
 * Fase 2/3 vai conectar com o módulo /crm interno + reuniões + satisfação.
 */
export function CRMPlaceholderSection() {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Seu CRM</h2>
              <p className="text-xs text-muted-foreground">Tracking de leads e atividades</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Construction className="h-3 w-3" />
            Em breve
          </span>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <ComingSoonItem text="Leads gerados pra você + funil onde cada um está" />
          <ComingSoonItem text="Próximas entregas e prazos" />
          <ComingSoonItem text="Histórico de atividades da equipe" />
          <ComingSoonItem text="Performance de campanhas em detalhe" />
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

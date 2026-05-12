import { Database, Construction } from "lucide-react";

/**
 * Placeholder visual da seção CRM. Fase 1 só mostra o card sem dados;
 * Fase 2/3 vai conectar com o módulo /crm interno + reuniões + satisfação.
 */
export function CRMPlaceholderSection() {
  return (
    <section className="rounded-xl border border-dashed bg-card/50 p-5 space-y-3">
      <header className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Seu CRM
        </h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
          <Construction className="h-3 w-3" />
          Em breve
        </span>
      </header>

      <p className="text-sm text-muted-foreground">
        Em breve você vai acompanhar aqui:
      </p>

      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/50" />
          Leads gerados pra você e onde cada um está no funil
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/50" />
          Resumos das últimas reuniões com a equipe
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/50" />
          Sua avaliação da Yide e como a equipe percebe vocês
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/50" />
          Próximas entregas e prazos
        </li>
      </ul>
    </section>
  );
}

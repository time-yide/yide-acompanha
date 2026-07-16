"use client";

import { Info } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const ITENS: Array<{ sigla: string; texto: string }> = [
  { sigla: "TPG", texto: "Tráfego Google" },
  { sigla: "TPM", texto: "Tráfego Meta" },
  { sigla: "GMN", texto: "Google Meu Negócio" },
  { sigla: "Gravação", texto: "nº de gravações no mês" },
  { sigla: "Edição", texto: "passou pelo time" },
  { sigla: "Reunião", texto: "agendada (tipo Assessores)" },
];

/**
 * Legenda das colunas do painel, escondida atrás de um ícone (antes era uma
 * parede de texto sempre visível acima da tabela). Some o ruído sem perder a
 * informação. Fica no toolbar, então serve tabela e cards.
 */
export function LegendaPopover() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <Info className="h-3.5 w-3.5" />
        Legenda
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-xs font-semibold">O que cada coluna significa</p>
        <ul className="space-y-1">
          {ITENS.map((it) => (
            <li key={it.sigla} className="text-[11.5px] text-muted-foreground">
              <b className="text-foreground/80">{it.sigla}</b> — {it.texto}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

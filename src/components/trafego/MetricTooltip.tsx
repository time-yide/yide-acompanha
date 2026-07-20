"use client";

import { HelpCircle } from "lucide-react";

/**
 * Dicionário de explicações curtas, em linguagem de iniciante, pras métricas
 * principais do painel. A key bate com a `key` de `METRICAS_DISPONIVEIS`
 * (metricas.ts) — mais alguns apelidos amigáveis usados só na UI.
 */
export const EXPLICACOES: Record<string, string> = {
  spend: "Quanto já foi investido nesta campanha no período.",
  resultados:
    "Quantos resultados o anúncio trouxe (contatos/leads ou conversões, o que a campanha mede).",
  leads: "Quantos contatos (leads) o anúncio trouxe.",
  conversions: "Quantas conversões o anúncio gerou (ex.: compras, cadastros).",
  cost_per_lead: "Quanto custou, em média, cada contato (lead) trazido.",
  cost_per_conversion: "Quanto custou, em média, cada conversão (ex.: cada venda).",
  custo_por_resultado: "Quanto custou, em média, cada resultado obtido.",
  reach: "Quantas pessoas DIFERENTES viram o anúncio (sem contar repetições).",
  impressions: "Quantas vezes o anúncio apareceu na tela (contando repetições).",
  clicks: "Quantas vezes as pessoas clicaram no anúncio.",
  ctr: "Dos que viram, a porcentagem que clicou. Quanto maior, mais chamativo.",
  cpc: "Quanto custou, em média, cada clique.",
  cpm: "Quanto custou mostrar o anúncio 1.000 vezes.",
  frequency: "Quantas vezes, em média, a mesma pessoa viu o anúncio.",
};

/**
 * Ícone de "?" com explicação ao passar o mouse (tooltip via CSS, sem lib).
 * Também usa `title` nativo pra acessibilidade e toque no mobile.
 */
export function MetricTooltip({ texto }: { texto: string }) {
  return (
    <span className="group/tt relative inline-flex align-middle">
      <HelpCircle
        className="h-3 w-3 cursor-help text-muted-foreground/60 hover:text-muted-foreground"
        aria-hidden
      />
      <span className="sr-only">{texto}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-48 -translate-x-1/2 rounded-md border bg-popover px-2 py-1.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-popover-foreground opacity-0 shadow-md transition-opacity duration-100 group-hover/tt:opacity-100"
      >
        {texto}
      </span>
    </span>
  );
}

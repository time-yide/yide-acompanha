"use client";

import { DollarSign, Target, Coins, Users, MousePointerClick } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatMetricaValor, type MetricaUnidade } from "@/lib/trafego/metricas";
import { MetricTooltip, EXPLICACOES } from "./MetricTooltip";

function explicacao(key: string): string {
  return EXPLICACOES[key] ?? "";
}

/**
 * Fonte de números — aceita tanto o `agregado` da campanha (Record chave→valor)
 * quanto um `MetaInsightsAggregate` de drill-down (conjunto/anúncio). Só lemos
 * as chaves que existem em ambos.
 */
export interface ResumoFonte {
  spend?: number | null;
  reach?: number | null;
  clicks?: number | null;
  leads?: number | null;
  conversions?: number | null;
  cost_per_lead?: number | null;
  cost_per_conversion?: number | null;
}

function num(v: number | null | undefined): number | null {
  return v === null || v === undefined || Number.isNaN(v) ? null : v;
}

/**
 * Escolhe o "resultado" da campanha: prioriza leads; se não houver, conversões.
 * Retorna também o custo por resultado e um rótulo amigável.
 */
function escolherResultado(f: ResumoFonte): {
  valor: number | null;
  custo: number | null;
  labelResultado: string;
  labelCusto: string;
  keyResultado: string;
  keyCusto: string;
} {
  const leads = num(f.leads);
  const conv = num(f.conversions);
  if (leads != null && leads > 0) {
    return {
      valor: leads,
      custo: num(f.cost_per_lead),
      labelResultado: "Contatos (leads)",
      labelCusto: "Custo por contato",
      keyResultado: "leads",
      keyCusto: "cost_per_lead",
    };
  }
  if (conv != null && conv > 0) {
    return {
      valor: conv,
      custo: num(f.cost_per_conversion),
      labelResultado: "Conversões",
      labelCusto: "Custo por conversão",
      keyResultado: "conversions",
      keyCusto: "cost_per_conversion",
    };
  }
  // Nenhum resultado ainda: mostra leads como 0 (mais comum na agência).
  return {
    valor: leads ?? conv ?? null,
    custo: null,
    labelResultado: "Resultados",
    labelCusto: "Custo por resultado",
    keyResultado: "resultados",
    keyCusto: "custo_por_resultado",
  };
}

interface Item {
  label: string;
  valor: number | null;
  unidade: MetricaUnidade;
  icon: LucideIcon;
  explicacaoKey: string;
  destaque?: boolean;
}

/** Todos os valores nulos/zerados → sem dados no período. */
function semDados(f: ResumoFonte): boolean {
  const vals = [f.spend, f.reach, f.clicks, f.leads, f.conversions];
  return vals.every((v) => num(v) == null || v === 0);
}

/**
 * Resumo visual, escaneável, dos principais números — reutilizado no card da
 * campanha, nos conjuntos e nos anúncios. `size` controla a densidade.
 */
export function MetricaResumo({
  fonte,
  size = "lg",
}: {
  fonte: ResumoFonte;
  size?: "lg" | "sm";
}) {
  if (semDados(fonte)) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        Sem dados no período.
      </p>
    );
  }

  const r = escolherResultado(fonte);
  const itens: Item[] = [
    {
      label: "Gasto",
      valor: num(fonte.spend),
      unidade: "moeda",
      icon: DollarSign,
      explicacaoKey: "spend",
      destaque: true,
    },
    {
      label: r.labelResultado,
      valor: r.valor,
      unidade: "numero",
      icon: Target,
      explicacaoKey: r.keyResultado,
      destaque: true,
    },
    {
      label: r.labelCusto,
      valor: r.custo,
      unidade: "moeda",
      icon: Coins,
      explicacaoKey: r.keyCusto,
      destaque: true,
    },
    {
      label: "Alcance",
      valor: num(fonte.reach),
      unidade: "numero",
      icon: Users,
      explicacaoKey: "reach",
    },
    {
      label: "Cliques",
      valor: num(fonte.clicks),
      unidade: "numero",
      icon: MousePointerClick,
      explicacaoKey: "clicks",
    },
  ];

  const valorClass = size === "lg" ? "text-lg" : "text-sm";
  const gap = size === "lg" ? "gap-3" : "gap-2";

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 ${gap}`}
    >
      {itens.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className={`rounded-md border p-2.5 ${
              it.destaque ? "bg-muted/30" : "bg-muted/10"
            }`}
          >
            <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{it.label}</span>
              <MetricTooltip texto={explicacao(it.explicacaoKey)} />
            </div>
            <p className={`font-semibold tabular-nums ${valorClass}`}>
              {it.valor == null
                ? "—"
                : formatMetricaValor(it.valor, it.unidade)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

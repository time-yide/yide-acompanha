import { Users, Clock, DollarSign, Activity, TrendingUp } from "lucide-react";
import type { ProdutividadeSummary } from "@/lib/produtividade/queries";

interface Props {
  summary: ProdutividadeSummary;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CARDS = [
  {
    label: "Online agora",
    icon: Users,
    tone: "emerald",
    getValue: (s: ProdutividadeSummary) => `${s.online_agora}/${s.total_colaboradores}`,
    getHint: (s: ProdutividadeSummary) =>
      `${s.ativos_agora} ativo${s.ativos_agora === 1 ? "" : "s"} agora`,
  },
  {
    label: "Tempo ativo (total hoje)",
    icon: Clock,
    tone: "blue",
    getValue: (s: ProdutividadeSummary) => formatHours(s.tempo_ativo_total_seg_hoje),
    getHint: () => "soma da equipe",
  },
  {
    label: "Eventos hoje",
    icon: Activity,
    tone: "violet",
    getValue: (s: ProdutividadeSummary) => s.eventos_hoje.toLocaleString("pt-BR"),
    getHint: () => "ações no sistema",
  },
  {
    label: "Custo do dia",
    icon: DollarSign,
    tone: "amber",
    getValue: (s: ProdutividadeSummary) => formatBRL(s.custo_dia_total),
    getHint: (s: ProdutividadeSummary) =>
      s.custo_hora_medio !== null
        ? `R$ ${s.custo_hora_medio.toFixed(2)}/h médio`
        : "sem dados de custo",
  },
] as const;

const TONE_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
  },
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
  },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
  },
};

export function ProdutividadeSummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const tone = TONE_CLASSES[card.tone];
        return (
          <div
            key={card.label}
            className={`rounded-xl border ${tone.border} bg-card p-4`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {card.label}
              </div>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-md ${tone.bg} ${tone.text}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums">
              {card.getValue(summary)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <TrendingUp className="h-2.5 w-2.5" />
              {card.getHint(summary)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Re-export pra páginas usarem
export { formatHours, formatBRL };

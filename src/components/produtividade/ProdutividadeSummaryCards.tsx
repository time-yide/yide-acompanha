import { Users, Clock, DollarSign, Activity, TrendingUp, AlertTriangle, Package } from "lucide-react";
import type { ProdutividadeSummary } from "@/lib/produtividade/queries";

interface Props {
  summary: ProdutividadeSummary;
  /** Label do período ativo - ex.: "Hoje", "Últimos 7 dias". */
  periodoLabel?: string;
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
    label: "Tempo ativo (período)",
    icon: Clock,
    tone: "blue",
    getValue: (s: ProdutividadeSummary) => formatHours(s.tempo_ativo_total_seg_hoje),
    getHint: (s: ProdutividadeSummary) => {
      const horasMedia =
        s.total_colaboradores > 0
          ? s.tempo_ativo_total_seg_hoje / 3600 / s.total_colaboradores
          : 0;
      return horasMedia > 0
        ? `${horasMedia.toFixed(1)}h por colaborador (média)`
        : "soma da equipe";
    },
  },
  {
    label: "Eventos no período",
    icon: Activity,
    tone: "violet",
    getValue: (s: ProdutividadeSummary) => s.eventos_hoje.toLocaleString("pt-BR"),
    getHint: () => "ações no sistema",
  },
  {
    label: "Atrasados (agora)",
    icon: AlertTriangle,
    tone: "rose",
    getValue: (s: ProdutividadeSummary) =>
      (s.tarefas_atrasadas_total + s.capturas_atrasadas_total).toLocaleString("pt-BR"),
    getHint: (s: ProdutividadeSummary) => {
      const partes: string[] = [];
      if (s.tarefas_atrasadas_total > 0) {
        partes.push(`${s.tarefas_atrasadas_total} tarefa${s.tarefas_atrasadas_total === 1 ? "" : "s"}`);
      }
      if (s.capturas_atrasadas_total > 0) {
        partes.push(`${s.capturas_atrasadas_total} captura${s.capturas_atrasadas_total === 1 ? "" : "s"}`);
      }
      if (partes.length === 0) return "tudo em dia ✓";
      return `${partes.join(" · ")} (${s.colaboradores_com_atraso} pessoa${s.colaboradores_com_atraso === 1 ? "" : "s"})`;
    },
  },
  {
    label: "Custo do período",
    icon: DollarSign,
    tone: "amber",
    getValue: (s: ProdutividadeSummary) => formatBRL(s.custo_periodo_total),
    getHint: (s: ProdutividadeSummary) =>
      s.custo_hora_medio !== null
        ? `R$ ${s.custo_hora_medio.toFixed(2)}/h médio (fixo)`
        : "sem salário fixo cadastrado",
  },
  {
    label: "Custo por entrega",
    icon: Package,
    tone: "violet",
    getValue: (s: ProdutividadeSummary) =>
      s.custo_por_entrega !== null ? formatBRL(s.custo_por_entrega) : "—",
    getHint: (s: ProdutividadeSummary) =>
      s.entregas_total > 0
        ? `${s.entregas_total.toLocaleString("pt-BR")} entrega${s.entregas_total === 1 ? "" : "s"} no período`
        : "nenhuma entrega no período",
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
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/20",
  },
};

export function ProdutividadeSummaryCards({ summary, periodoLabel }: Props) {
  return (
    <div className="space-y-2">
      {periodoLabel && (
        <p className="text-xs text-muted-foreground">
          Mostrando dados de{" "}
          <span className="font-medium text-foreground">{periodoLabel}</span>.{" "}
          <span className="text-rose-600 dark:text-rose-400">Online</span> e{" "}
          <span className="text-rose-600 dark:text-rose-400">Atrasados</span> sempre refletem o estado atual.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
    </div>
  );
}

// Re-export pra páginas usarem
export { formatHours, formatBRL };

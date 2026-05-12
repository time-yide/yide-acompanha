import { AlertCircle, TrendingUp, AlertTriangle, Sparkles, HelpCircle, CheckSquare } from "lucide-react";
import { INSIGHT_TIPO_LABEL, formatTimestamp, type InsightTipo, type MeetingInsight } from "@/lib/reunioes/tipos";

interface Props {
  insights: MeetingInsight[];
}

const TIPO_CONFIG: Record<InsightTipo, {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  text: string;
}> = {
  objecao: {
    icon: AlertCircle,
    bg: "bg-rose-500/5",
    border: "border-rose-500/40",
    text: "text-rose-600 dark:text-rose-400",
  },
  sinal_compra: {
    icon: TrendingUp,
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/40",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  risco: {
    icon: AlertTriangle,
    bg: "bg-amber-500/5",
    border: "border-amber-500/40",
    text: "text-amber-600 dark:text-amber-400",
  },
  oportunidade: {
    icon: Sparkles,
    bg: "bg-purple-500/5",
    border: "border-purple-500/40",
    text: "text-purple-600 dark:text-purple-400",
  },
  duvida: {
    icon: HelpCircle,
    bg: "bg-blue-500/5",
    border: "border-blue-500/40",
    text: "text-blue-600 dark:text-blue-400",
  },
  decisao: {
    icon: CheckSquare,
    bg: "bg-cyan-500/5",
    border: "border-cyan-500/40",
    text: "text-cyan-600 dark:text-cyan-400",
  },
};

export function InsightsPanel({ insights }: Props) {
  if (insights.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        A IA não identificou insights destacáveis nesta reunião.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {insights.map((ins, i) => {
        const cfg = TIPO_CONFIG[ins.tipo];
        const Icon = cfg.icon;
        return (
          <article
            key={i}
            className={`rounded-xl border-l-2 p-3 ${cfg.bg} ${cfg.border}`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 rounded-md ${cfg.bg} p-1.5 ${cfg.text}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.text}`}>
                    {INSIGHT_TIPO_LABEL[ins.tipo]}
                  </span>
                  {ins.timestamp_segundos !== null && (
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {formatTimestamp(ins.timestamp_segundos)}
                    </span>
                  )}
                </div>
                <p className="text-sm">{ins.texto}</p>
                {ins.citacao && (
                  <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-xs italic text-muted-foreground">
                    &ldquo;{ins.citacao}&rdquo;
                  </blockquote>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

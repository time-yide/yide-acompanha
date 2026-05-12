import { Sparkles, CheckSquare, ArrowRight, Smile, Meh, Frown } from "lucide-react";
import type { MeetingSummary } from "@/lib/reunioes/tipos";

interface Props {
  summary: MeetingSummary;
}

function SentimentChip({ score }: { score: number | null }) {
  if (score === null) return null;
  let Icon = Meh;
  let cor = "border-muted-foreground/30 text-muted-foreground";
  let label = "Neutro";
  if (score >= 0.4) {
    Icon = Smile;
    cor = "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    label = "Positivo";
  } else if (score <= -0.3) {
    Icon = Frown;
    cor = "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400";
    label = "Negativo";
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cor}`}>
      <Icon className="h-3 w-3" />
      Sentimento: {label} ({score.toFixed(2)})
    </span>
  );
}

export function SummaryPanel({ summary }: Props) {
  return (
    <div className="space-y-5">
      {/* Resumo geral */}
      <section className="rounded-xl border bg-gradient-to-br from-primary/5 via-card to-card p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/15 p-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">Resumo da reunião</h3>
          </div>
          <SentimentChip score={summary.sentimento_score} />
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {summary.resumo_geral}
        </p>
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          Gerado por {summary.provider} {summary.modelo ? `(${summary.modelo})` : ""}
        </p>
      </section>

      {/* Decisões */}
      {summary.decisoes.length > 0 && (
        <section className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/80">
            <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
            Decisões tomadas
          </h4>
          <ul className="space-y-2">
            {summary.decisoes.map((d, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-lg border-l-2 border-emerald-500/50 bg-emerald-500/5 px-3 py-2 text-sm"
              >
                <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Próximos passos */}
      {summary.proximos_passos.length > 0 && (
        <section className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/80">
            <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
            Próximos passos
          </h4>
          <ul className="space-y-2">
            {summary.proximos_passos.map((p, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-lg border-l-2 border-blue-500/50 bg-blue-500/5 px-3 py-2 text-sm"
              >
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

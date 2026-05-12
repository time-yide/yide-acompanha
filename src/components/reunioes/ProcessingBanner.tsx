import { FileText, Sparkles, ListChecks, Mic, Loader2 } from "lucide-react";

interface Props {
  /** Flags do meeting indicando o que já tá pronto. */
  recordingReady: boolean;
  transcriptReady: boolean;
  summaryReady: boolean;
  insightsReady: boolean;
}

interface Step {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
}

/**
 * Banner premium mostrando o pipeline de processamento de uma reunião.
 * Aparece quando a reunião tá em status='processing' ou tem flags
 * faltando. Fica auto-hidden quando tudo pronto (recording + transcript +
 * summary + insights ready).
 *
 * Em conjunto com MeetingRealtimeWatcher, atualiza ao vivo conforme
 * cada etapa termina.
 */
export function ProcessingBanner({
  recordingReady,
  transcriptReady,
  summaryReady,
  insightsReady,
}: Props) {
  const steps: Step[] = [
    { id: "recording", label: "Gravação recebida", icon: Mic, done: recordingReady },
    { id: "transcript", label: "Transcrição", icon: FileText, done: transcriptReady },
    { id: "summary", label: "Resumo + tópicos", icon: Sparkles, done: summaryReady },
    { id: "tasks", label: "Insights + tarefas", icon: ListChecks, done: insightsReady },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const currentIdx = steps.findIndex((s) => !s.done);
  const totalDone = steps.filter((s) => s.done).length;
  const totalProgress = Math.round((totalDone / steps.length) * 100);

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-amber-500/15 p-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              IA processando…
            </p>
            <p className="text-xs text-muted-foreground">
              Atualiza automaticamente quando cada etapa terminar.
            </p>
          </div>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {totalProgress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-amber-500 transition-all duration-500"
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, i) => {
          const isCurrent = i === currentIdx;
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`rounded-lg border p-2 text-center transition-colors ${
                step.done
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : isCurrent
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-muted-foreground/20 bg-muted/20"
              }`}
            >
              <Icon
                className={`mx-auto h-4 w-4 ${
                  step.done
                    ? "text-emerald-500"
                    : isCurrent
                      ? "animate-pulse text-amber-500"
                      : "text-muted-foreground/40"
                }`}
              />
              <p
                className={`mt-1 line-clamp-1 text-[10px] uppercase tracking-wider ${
                  step.done
                    ? "font-medium text-emerald-700 dark:text-emerald-400"
                    : isCurrent
                      ? "font-medium text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

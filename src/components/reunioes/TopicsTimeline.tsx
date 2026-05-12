import { formatTimestamp, type MeetingTopic } from "@/lib/reunioes/tipos";
import { Clock } from "lucide-react";

interface Props {
  topicos: MeetingTopic[];
  duracaoTotal: number | null;
}

/**
 * Linha do tempo dos tópicos. Mostra cada tópico como bloco com timestamp +
 * resumo. Visual de "minimap" no topo mostrando proporção de cada bloco.
 */
export function TopicsTimeline({ topicos, duracaoTotal }: Props) {
  if (topicos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Tópicos ainda não foram extraídos.
      </div>
    );
  }

  const total = duracaoTotal ?? topicos[topicos.length - 1].end_seconds;

  return (
    <div className="space-y-4">
      {/* Minimap visual */}
      <div className="space-y-1">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {topicos.map((t, i) => {
            const w = ((t.end_seconds - t.start_seconds) / total) * 100;
            return (
              <div
                key={i}
                className={`h-full ${["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"][i % 5]} transition-opacity hover:opacity-80`}
                style={{ width: `${w}%` }}
                title={t.titulo}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
          <span>00:00</span>
          <span>{formatTimestamp(total)}</span>
        </div>
      </div>

      {/* Lista dos tópicos */}
      <div className="space-y-2">
        {topicos.map((t, i) => (
          <article
            key={i}
            className="group flex gap-3 rounded-lg border bg-card p-3 transition-all hover:border-primary/40"
          >
            <div className="flex flex-col items-center gap-1 pt-0.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                  ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"][i % 5]
                }`}
              >
                {i + 1}
              </div>
              <div className="w-px flex-1 bg-border" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold">{t.titulo}</h4>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(t.start_seconds)} → {formatTimestamp(t.end_seconds)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{t.resumo}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

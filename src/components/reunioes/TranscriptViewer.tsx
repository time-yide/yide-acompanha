import { formatTimestamp, type TranscriptSegment } from "@/lib/reunioes/tipos";
import { ParticipantAvatar } from "./ParticipantAvatar";

interface Props {
  segments: TranscriptSegment[];
}

/**
 * Lista de segmentos da transcrição com timestamps clicáveis.
 * Cada segmento mostra avatar do speaker + texto + tempo.
 */
export function TranscriptViewer({ segments }: Props) {
  if (segments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Sem transcrição disponível ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((seg, idx) => (
        <article
          key={idx}
          className="group flex gap-3 rounded-lg border bg-card/50 p-3 transition-colors hover:bg-card hover:border-primary/30"
        >
          <ParticipantAvatar nome={seg.speaker} size="sm" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold">{seg.speaker}</span>
              <button
                type="button"
                className="text-[10px] font-mono text-muted-foreground tabular-nums hover:text-primary"
                title={`Pular para ${formatTimestamp(seg.start)}`}
              >
                {formatTimestamp(seg.start)}
              </button>
            </div>
            <p className="text-sm leading-relaxed">{seg.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

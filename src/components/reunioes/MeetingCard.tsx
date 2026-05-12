import Link from "next/link";
import {
  Clock, Video, FileText, Sparkles, ListChecks, Tag, ChevronRight, Briefcase, Users,
} from "lucide-react";
import {
  MEETING_SOURCE_LABEL,
  formatDuracao,
  type MeetingListItem,
} from "@/lib/reunioes/tipos";
import { ParticipantStack } from "./ParticipantAvatar";
import { MeetingStatusBadge } from "./MeetingStatusBadge";

function formatDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function temporalLabel(iso: string): string {
  const d = new Date(iso);
  const diffMin = (d.getTime() - Date.now()) / 60000;
  if (diffMin > 0 && diffMin < 60) return `Começa em ${Math.round(diffMin)}min`;
  if (diffMin >= 60 && diffMin < 1440) return `Começa em ${Math.round(diffMin / 60)}h`;
  if (diffMin >= 1440) return `Daqui a ${Math.round(diffMin / 1440)} dias`;
  return formatDataHora(iso);
}

interface Props {
  meeting: MeetingListItem;
}

/**
 * Card moderno de reunião na lista. Mostra status + título + duração +
 * preview de avatars + tags + indicadores de processamento.
 */
export function MeetingCard({ meeting }: Props) {
  const isFutura = meeting.status === "scheduled";
  const isProcessing = meeting.status === "processing" || meeting.status === "in_progress";

  return (
    <Link
      href={`/reunioes/${meeting.id}`}
      className="group relative block overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      {/* Faixa lateral colorida indicando status */}
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          meeting.status === "in_progress"
            ? "bg-emerald-500"
            : meeting.status === "processing"
              ? "bg-amber-500"
              : meeting.status === "scheduled"
                ? "bg-blue-500"
                : meeting.status === "failed"
                  ? "bg-rose-500"
                  : "bg-muted-foreground/30"
        }`}
      />

      <div className="ml-2 space-y-3">
        {/* Linha 1: status + source + título */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <MeetingStatusBadge status={meeting.status} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {MEETING_SOURCE_LABEL[meeting.source]}
              </span>
              {isFutura && (
                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                  {temporalLabel(meeting.starts_at)}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold leading-snug group-hover:text-primary">
              {meeting.titulo}
            </h3>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </div>

        {/* Linha 2: data, duração, owner */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDataHora(meeting.starts_at)}
          </span>
          {meeting.duracao_segundos !== null && (
            <span className="inline-flex items-center gap-1">
              <Video className="h-3 w-3" />
              {formatDuracao(meeting.duracao_segundos)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {meeting.participantes_count} participante{meeting.participantes_count !== 1 ? "s" : ""}
          </span>
          {(meeting.lead_nome || meeting.client_nome) && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Briefcase className="h-3 w-3" />
              {meeting.client_nome ?? meeting.lead_nome}
            </span>
          )}
        </div>

        {/* Resumo IA preview */}
        {meeting.resumo_preview && (
          <p
            className={`line-clamp-2 rounded-lg border-l-2 px-3 py-2 text-xs italic ${
              isProcessing
                ? "border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-300 animate-pulse"
                : "border-primary/40 bg-primary/5 text-muted-foreground"
            }`}
          >
            <Sparkles className={`mr-1 inline h-3 w-3 ${isProcessing ? "" : "text-primary"}`} />
            {meeting.resumo_preview}
          </p>
        )}

        {/* Footer: avatares + tags + indicadores */}
        <div className="flex items-center justify-between gap-3">
          <ParticipantStack nomes={meeting.participantes_preview.map((p) => p.nome)} />
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {meeting.tags.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {meeting.tags.slice(0, 2).join(" · ")}
              </span>
            )}
            {meeting.transcript_ready && (
              <span className="inline-flex items-center gap-1" title="Transcrição pronta">
                <FileText className="h-3 w-3 text-emerald-500" />
              </span>
            )}
            {meeting.summary_ready && (
              <span className="inline-flex items-center gap-1" title="Resumo IA pronto">
                <Sparkles className="h-3 w-3 text-primary" />
              </span>
            )}
            {meeting.tasks_geradas_count > 0 && (
              <span className="inline-flex items-center gap-1" title="Tarefas geradas">
                <ListChecks className="h-3 w-3" />
                {meeting.tasks_geradas_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

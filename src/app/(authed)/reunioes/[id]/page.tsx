import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Mic, Calendar, Users, Briefcase, ExternalLink, Tag,
  Sparkles, FileText, Layers, AlertCircle, ListChecks, Clock,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getMeetingById } from "@/lib/reunioes/queries";
import {
  formatDuracao,
  MEETING_SOURCE_LABEL,
} from "@/lib/reunioes/tipos";
import { MeetingStatusBadge } from "@/components/reunioes/MeetingStatusBadge";
import { ParticipantAvatar } from "@/components/reunioes/ParticipantAvatar";
import { RecordingPlayer } from "@/components/reunioes/RecordingPlayer";
import { UploadAudioButton } from "@/components/reunioes/UploadAudioButton";
import { TranscriptViewer } from "@/components/reunioes/TranscriptViewer";
import { SummaryPanel } from "@/components/reunioes/SummaryPanel";
import { TopicsTimeline } from "@/components/reunioes/TopicsTimeline";
import { InsightsPanel } from "@/components/reunioes/InsightsPanel";
import { ExtractedTasksPanel } from "@/components/reunioes/ExtractedTasksPanel";
import { MeetingDetailTabs } from "@/components/reunioes/MeetingDetailTabs";

const ALLOWED_ROLES = [
  "adm", "socio", "comercial", "coordenador", "assessor", "audiovisual_chefe",
];

function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function ReuniaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const { id } = await params;
  const meeting = await getMeetingById(id);
  if (!meeting) notFound();

  const tabs = [
    {
      id: "resumo" as const,
      label: "Resumo IA",
      icon: Sparkles,
      content: meeting.summary ? (
        <SummaryPanel summary={meeting.summary} />
      ) : (
        <EmptyTab message="Resumo da IA será gerado quando a reunião terminar." />
      ),
    },
    {
      id: "topicos" as const,
      label: "Tópicos",
      icon: Layers,
      badge: meeting.summary?.topicos.length ?? 0,
      content: meeting.summary ? (
        <TopicsTimeline topicos={meeting.summary.topicos} duracaoTotal={meeting.duracao_segundos} />
      ) : (
        <EmptyTab message="Tópicos aparecem após processamento IA." />
      ),
    },
    {
      id: "transcricao" as const,
      label: "Transcrição",
      icon: FileText,
      badge: meeting.transcript?.segments.length ?? 0,
      content: meeting.transcript ? (
        <TranscriptViewer segments={meeting.transcript.segments} />
      ) : (
        <EmptyTab message="Transcrição em processamento." />
      ),
    },
    {
      id: "insights" as const,
      label: "Insights",
      icon: AlertCircle,
      badge: meeting.summary?.insights.length ?? 0,
      content: meeting.summary ? (
        <InsightsPanel insights={meeting.summary.insights} />
      ) : (
        <EmptyTab message="Insights são detectados pela IA durante o pós-processamento." />
      ),
    },
    {
      id: "tarefas" as const,
      label: "Tarefas",
      icon: ListChecks,
      badge: meeting.extracted_tasks.length,
      content: <ExtractedTasksPanel tasks={meeting.extracted_tasks} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/reunioes"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Voltar para Reuniões
      </Link>

      {/* Header da reunião */}
      <header className="rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <MeetingStatusBadge status={meeting.status} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {MEETING_SOURCE_LABEL[meeting.source]}
              </span>
              {meeting.tags.length > 0 && meeting.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Mic className="h-6 w-6 text-primary shrink-0" />
              {meeting.titulo}
            </h1>
            {meeting.descricao && (
              <p className="text-sm text-muted-foreground max-w-2xl">{meeting.descricao}</p>
            )}
          </div>
          {meeting.external_url && (
            <a
              href={meeting.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver no Meet
            </a>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDataHora(meeting.starts_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDuracao(meeting.duracao_segundos)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {meeting.participantes_count} participante{meeting.participantes_count !== 1 ? "s" : ""}
          </span>
          {(meeting.lead_nome || meeting.client_nome) && (
            <Link
              href={meeting.lead_id ? `/onboarding/${meeting.lead_id}` : `/clientes`}
              className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <Briefcase className="h-3.5 w-3.5" />
              {meeting.client_nome ?? meeting.lead_nome}
            </Link>
          )}
        </div>

        {/* Participantes */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Participaram
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {meeting.participantes.map((p) => (
              <div key={p.id} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-1">
                <ParticipantAvatar nome={p.nome} size="xs" />
                <div className="text-xs">
                  <span className="font-medium">{p.nome}</span>
                  {p.papel === "host" && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(host)</span>
                  )}
                </div>
                {p.tempo_falando_segundos !== null && (
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {formatDuracao(p.tempo_falando_segundos)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Player ou Upload */}
        <div className="pt-1">
          {meeting.recording ? (
            <RecordingPlayer recording={meeting.recording} />
          ) : (
            <UploadAudioButton meetingId={meeting.id} />
          )}
        </div>
      </header>

      {/* Tabs com conteúdo */}
      <MeetingDetailTabs tabs={tabs} initial="resumo" />

      {/* Processing jobs (apenas se tiver erros) */}
      {meeting.processing_jobs.some((j) => j.status === "failed") && (
        <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            Erros no processamento
          </h3>
          <ul className="mt-2 space-y-1 text-xs">
            {meeting.processing_jobs
              .filter((j) => j.status === "failed")
              .map((j) => (
                <li key={j.step}>
                  <span className="font-medium">{j.step}</span>: {j.last_error ?? "erro desconhecido"}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

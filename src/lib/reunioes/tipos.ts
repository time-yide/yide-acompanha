// Tipos compartilhados do módulo Reuniões. Espelham o schema SQL mas com
// shape friendly pra UI (camelCase, datas como string ISO, etc).

export type MeetingStatus =
  | "scheduled"
  | "in_progress"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type MeetingSource = "google_meet" | "zoom" | "teams" | "manual_upload";

export type ProcessingStep =
  | "recording"
  | "transcription"
  | "summarization"
  | "insights"
  | "tasks_extraction"
  | "follow_up";

export type ProcessingStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface ParticipantSummary {
  id: string;
  profile_id: string | null;
  nome: string;
  email: string | null;
  papel: "host" | "attendee" | "bot";
  tempo_presenca_segundos: number | null;
  tempo_falando_segundos: number | null;
  avatar_url?: string | null;
}

export interface TranscriptSegment {
  /** ID do speaker (UUID do profile se interno, ou string sintética). */
  speaker_id: string | null;
  /** Nome exibido. */
  speaker: string;
  /** Em segundos desde o início da reunião. */
  start: number;
  end: number;
  text: string;
}

export interface MeetingTopic {
  titulo: string;
  start_seconds: number;
  end_seconds: number;
  resumo: string;
}

export type InsightTipo = "objecao" | "sinal_compra" | "risco" | "oportunidade" | "duvida" | "decisao";

export interface MeetingInsight {
  tipo: InsightTipo;
  texto: string;
  timestamp_segundos: number | null;
  citacao: string | null;
}

export interface MeetingExtractedTask {
  id: string;
  titulo_sugerido: string;
  descricao_sugerida: string | null;
  atribuido_a_sugestao: string | null;
  atribuido_a_nome: string | null;
  due_date_sugestao: string | null;
  estado: "sugerida" | "aceita" | "descartada";
  task_id: string | null;
  citacao_origem: string | null;
  timestamp_origem_segundos: number | null;
}

export interface MeetingRecording {
  id: string;
  audio_url: string | null;
  video_url: string | null;
  duracao_segundos: number | null;
  size_bytes: number | null;
  formato: string | null;
  provider: string | null;
}

export interface MeetingSummary {
  resumo_geral: string;
  decisoes: string[];
  proximos_passos: string[];
  topicos: MeetingTopic[];
  insights: MeetingInsight[];
  sentimento_score: number | null;
  provider: string;
  modelo: string | null;
}

export interface MeetingListItem {
  id: string;
  titulo: string;
  status: MeetingStatus;
  source: MeetingSource;
  starts_at: string;
  ends_at: string | null;
  duracao_segundos: number | null;
  owner_user_id: string;
  owner_nome: string;
  owner_avatar: string | null;
  participantes_count: number;
  /** Primeiros 4 participantes pra mostrar avatars no card. */
  participantes_preview: ParticipantSummary[];
  /** Marcadores rápidos pra UI mostrar status de processamento. */
  recording_ready: boolean;
  transcript_ready: boolean;
  summary_ready: boolean;
  insights_ready: boolean;
  /** Lead/cliente vinculado (preview). */
  lead_id: string | null;
  lead_nome: string | null;
  client_id: string | null;
  client_nome: string | null;
  tags: string[];
  /** Resumo de uma linha pra preview no card. */
  resumo_preview: string | null;
  /** Quantidade de tasks que foram aceitas a partir dessa reunião. */
  tasks_geradas_count: number;
}

export interface MeetingDetail extends MeetingListItem {
  descricao: string | null;
  external_url: string | null;
  participantes: ParticipantSummary[];
  recording: MeetingRecording | null;
  transcript: {
    texto_completo: string;
    segments: TranscriptSegment[];
    idioma: string;
    provider: string;
  } | null;
  summary: MeetingSummary | null;
  extracted_tasks: MeetingExtractedTask[];
  processing_jobs: Array<{
    step: ProcessingStep;
    status: ProcessingStatus;
    last_error: string | null;
    finished_at: string | null;
  }>;
}

// ─── Labels pra UI ─────────────────────────────────────────────────────────

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  processing: "Processando",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export const MEETING_SOURCE_LABEL: Record<MeetingSource, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  manual_upload: "Upload manual",
};

export const INSIGHT_TIPO_LABEL: Record<InsightTipo, string> = {
  objecao: "Objeção",
  sinal_compra: "Sinal de compra",
  risco: "Risco",
  oportunidade: "Oportunidade",
  duvida: "Dúvida",
  decisao: "Decisão",
};

export const PROCESSING_STEP_LABEL: Record<ProcessingStep, string> = {
  recording: "Gravação",
  transcription: "Transcrição",
  summarization: "Resumo",
  insights: "Insights",
  tasks_extraction: "Extração de tarefas",
  follow_up: "Follow-up",
};

// ─── Helpers de formatação ─────────────────────────────────────────────────

export function formatDuracao(segundos: number | null | undefined): string {
  if (!segundos || segundos <= 0) return "";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatTimestamp(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function meetingStatusBadgeClass(status: MeetingStatus): string {
  switch (status) {
    case "scheduled":
      return "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "in_progress":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "processing":
      return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "completed":
      return "border-muted-foreground/30 text-muted-foreground";
    case "failed":
      return "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400";
    case "cancelled":
      return "border-muted-foreground/30 text-muted-foreground line-through";
  }
}

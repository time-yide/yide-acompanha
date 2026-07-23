// Queries do módulo Reuniões — dados reais (Supabase service-role).
// SEM unstable_cache: a lista é filtrada por usuário (visibilidade), não pode
// ir pra cache compartilhado (ver memória "dados per-usuário fora do cache").

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { podeVerReuniao, MANAGEMENT_ROLES } from "./permissions";
import type { MeetingDetail, MeetingListItem, MeetingStatus } from "./tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export const MEETINGS_CACHE_TAG = "meetings" as const;

const SELECT_LIST = `
  id, titulo, status, source, starts_at, ends_at, duracao_segundos, owner_user_id,
  recording_ready, transcript_ready, summary_ready, insights_ready,
  lead_id, client_id, tags,
  owner:profiles!meetings_owner_user_id_fkey ( nome, avatar_url ),
  client:clients ( nome )
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMeetingRow(r: any): MeetingListItem {
  return {
    id: r.id,
    titulo: r.titulo,
    status: r.status as MeetingStatus,
    source: r.source,
    starts_at: r.starts_at,
    ends_at: r.ends_at ?? null,
    duracao_segundos: r.duracao_segundos ?? null,
    owner_user_id: r.owner_user_id,
    owner_nome: r.owner?.nome ?? "—",
    owner_avatar: r.owner?.avatar_url ?? null,
    participantes_count: 0,
    participantes_preview: [],
    recording_ready: !!r.recording_ready,
    transcript_ready: !!r.transcript_ready,
    summary_ready: !!r.summary_ready,
    insights_ready: !!r.insights_ready,
    lead_id: r.lead_id ?? null,
    lead_nome: null,
    client_id: r.client_id ?? null,
    client_nome: r.client?.nome ?? null,
    tags: r.tags ?? [],
    resumo_preview: null,
    tasks_geradas_count: 0,
  };
}

export interface ListMeetingsFilter {
  status?: MeetingStatus | "todos";
  searchQuery?: string;
  clientId?: string;
}

/** Lista reuniões visíveis pro usuário (dono + gestão). */
export async function listMeetings(
  user: { id: string; role: string },
  filter: ListMeetingsFilter = {},
): Promise<MeetingListItem[]> {
  const sb = createServiceRoleClient() as SB;
  let q = sb.from("meetings").select(SELECT_LIST).is("deleted_at", null).order("starts_at", { ascending: false });

  if (!(MANAGEMENT_ROLES as readonly string[]).includes(user.role)) {
    q = q.eq("owner_user_id", user.id);
  }
  if (filter.status && filter.status !== "todos") q = q.eq("status", filter.status);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);

  const { data } = await q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = ((data ?? []) as any[]).map(mapMeetingRow);
  if (filter.searchQuery?.trim()) {
    const s = filter.searchQuery.trim().toLowerCase();
    rows = rows.filter((m) => m.titulo.toLowerCase().includes(s) || (m.client_nome ?? "").toLowerCase().includes(s));
  }
  return rows;
}

/** Reuniões de um cliente específico (respeitando visibilidade). */
export async function listMeetingsForClient(
  user: { id: string; role: string },
  clientId: string,
): Promise<MeetingListItem[]> {
  return listMeetings(user, { clientId });
}

/** Detalhe. Na Fatia 1 traz só o essencial + recording; transcript/summary vêm null. */
export async function getMeetingById(
  user: { id: string; role: string },
  id: string,
): Promise<MeetingDetail | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: r } = await sb.from("meetings").select(SELECT_LIST + ", descricao, external_url").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!r) return null;
  if (!podeVerReuniao(user, { owner_user_id: r.owner_user_id })) return null;

  const base = mapMeetingRow(r);
  const { data: rec } = await sb.from("meeting_recordings").select("id, audio_url, video_url, duracao_segundos, size_bytes, formato, provider").eq("meeting_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: tr } = await sb
    .from("meeting_transcripts")
    .select("texto_completo, segments, idioma, provider")
    .eq("meeting_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...base,
    descricao: r.descricao ?? null,
    external_url: r.external_url ?? null,
    participantes: [],
    recording: rec
      ? { id: rec.id, audio_url: rec.audio_url ?? null, video_url: rec.video_url ?? null, duracao_segundos: rec.duracao_segundos ?? null, size_bytes: rec.size_bytes ?? null, formato: rec.formato ?? null, provider: rec.provider ?? null }
      : null,
    transcript: tr
      ? { texto_completo: tr.texto_completo, segments: (tr.segments ?? []) as unknown as import("./tipos").TranscriptSegment[], idioma: tr.idioma, provider: tr.provider }
      : null,
    summary: null,
    extracted_tasks: [],
    processing_jobs: [],
  };
}

export interface MeetingMetrics {
  total: number;
  totalDuracaoSegundos: number;
  porColaborador: Array<{ nome: string; user_id: string; quantidade: number; duracao_segundos: number }>;
  porStatus: Record<MeetingStatus, number>;
  porDiaSemana: Array<{ dia: number; total: number }>;
  topTags: Array<{ tag: string; count: number }>;
  tasksGeradas: number;
}

export async function getMeetingMetrics(user: { id: string; role: string }): Promise<MeetingMetrics> {
  const rows = await listMeetings(user);
  const porColaboradorMap = new Map<string, { nome: string; quantidade: number; duracao_segundos: number }>();
  const porStatus: Record<MeetingStatus, number> = { scheduled: 0, in_progress: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
  const porDiaSemana = Array.from({ length: 7 }, (_, i) => ({ dia: i, total: 0 }));
  const tagsMap = new Map<string, number>();
  let totalDuracao = 0;
  let tasksGeradas = 0;
  for (const m of rows) {
    porStatus[m.status]++;
    if (m.duracao_segundos) totalDuracao += m.duracao_segundos;
    tasksGeradas += m.tasks_geradas_count;
    const cur = porColaboradorMap.get(m.owner_user_id) ?? { nome: m.owner_nome, quantidade: 0, duracao_segundos: 0 };
    cur.quantidade += 1;
    cur.duracao_segundos += m.duracao_segundos ?? 0;
    porColaboradorMap.set(m.owner_user_id, cur);
    const dia = new Date(m.starts_at).getDay();
    porDiaSemana[dia].total += 1;
    for (const t of m.tags) tagsMap.set(t, (tagsMap.get(t) ?? 0) + 1);
  }
  const porColaborador = [...porColaboradorMap.entries()].map(([user_id, v]) => ({ user_id, ...v })).sort((a, b) => b.quantidade - a.quantidade);
  const topTags = [...tagsMap.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  return { total: rows.length, totalDuracaoSegundos: totalDuracao, porColaborador, porStatus, porDiaSemana, topTags, tasksGeradas };
}

/**
 * Retorna se o usuário já conectou conta Google. STUB — Google OAuth é fase
 * futura, fora do escopo da Fatia 1. Mantido pra não quebrar /reunioes/conectar.
 */
export async function getGoogleConnection(_userId: string) {
  void _userId;
  return { connected: false as const, google_email: null, scopes: [] as never[] };
}

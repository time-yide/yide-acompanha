// Queries do módulo Reuniões.
//
// Estratégia de fallback: tenta SELECT real em Supabase. Se a tabela ainda
// não foi criada (migration pendente), cai pro mock-data — UI continua
// funcionando pra demo. Quando a migration rodar, dados reais aparecem
// automaticamente.

import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { MOCK_MEETINGS, getMockMeetingById } from "./mock-data";
import type {
  MeetingDetail,
  MeetingListItem,
  MeetingStatus,
  ParticipantSummary,
} from "./tipos";

export const MEETINGS_CACHE_TAG = "meetings" as const;

export interface ListMeetingsFilter {
  status?: MeetingStatus | "todos";
  ownerUserId?: string;
  searchQuery?: string;
  desde?: string;
  ate?: string;
}

/**
 * Detecta se o erro do Supabase é "tabela não existe" — usado pra ativar
 * fallback pra mock data quando a migration ainda não foi aplicada.
 */
function isSchemaMissingError(error: { message?: string } | null | undefined): boolean {
  const msg = error?.message ?? "";
  return msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("not found");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRow = Record<string, any>;

function mapRowToListItem(row: SupabaseRow): MeetingListItem {
  const participantes = (row.participantes ?? []) as Array<{
    id: string;
    nome: string;
    papel: string;
    profile_id: string | null;
    tempo_presenca_segundos: number | null;
    tempo_falando_segundos: number | null;
    email: string | null;
  }>;
  const owner = row.owner as { nome?: string; avatar_url?: string | null } | null;
  return {
    id: row.id,
    titulo: row.titulo,
    status: row.status as MeetingStatus,
    source: row.source,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    duracao_segundos: row.duracao_segundos,
    owner_user_id: row.owner_user_id,
    owner_nome: owner?.nome ?? "—",
    owner_avatar: owner?.avatar_url ?? null,
    participantes_count: participantes.length,
    participantes_preview: participantes.slice(0, 4).map((p) => ({
      id: p.id,
      profile_id: p.profile_id,
      nome: p.nome,
      email: p.email,
      papel: p.papel as ParticipantSummary["papel"],
      tempo_presenca_segundos: p.tempo_presenca_segundos,
      tempo_falando_segundos: p.tempo_falando_segundos,
    })),
    recording_ready: row.recording_ready ?? false,
    transcript_ready: row.transcript_ready ?? false,
    summary_ready: row.summary_ready ?? false,
    insights_ready: row.insights_ready ?? false,
    lead_id: row.lead_id,
    lead_nome: (row.lead as { nome_prospect?: string } | null)?.nome_prospect ?? null,
    client_id: row.client_id,
    client_nome: (row.client as { nome?: string } | null)?.nome ?? null,
    tags: row.tags ?? [],
    resumo_preview: (row.summary as { resumo_geral?: string } | null)?.resumo_geral?.slice(0, 200) ?? null,
    tasks_geradas_count: (row.tasks_geradas as Array<{ count: number }> | null)?.[0]?.count ?? 0,
  };
}

async function _listMeetingsImpl(filter: ListMeetingsFilter): Promise<MeetingListItem[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let q = sb
    .from("meetings")
    .select(`
      id, titulo, status, source, starts_at, ends_at, duracao_segundos,
      owner_user_id, lead_id, client_id, tags,
      recording_ready, transcript_ready, summary_ready, insights_ready,
      owner:profiles!meetings_owner_user_id_fkey(nome, avatar_url),
      lead:leads!meetings_lead_id_fkey(nome_prospect),
      client:clients!meetings_client_id_fkey(nome),
      participantes:meeting_participants(id, nome, email, papel, profile_id, tempo_presenca_segundos, tempo_falando_segundos),
      summary:meeting_summaries(resumo_geral),
      tasks_geradas:meeting_extracted_tasks(count)
    `)
    .is("deleted_at", null);

  if (filter.status && filter.status !== "todos") {
    q = q.eq("status", filter.status);
  }
  if (filter.ownerUserId) {
    q = q.eq("owner_user_id", filter.ownerUserId);
  }
  if (filter.searchQuery && filter.searchQuery.trim()) {
    q = q.ilike("titulo", `%${filter.searchQuery.trim()}%`);
  }
  if (filter.desde) q = q.gte("starts_at", filter.desde);
  if (filter.ate) q = q.lte("starts_at", filter.ate);

  q = q.order("starts_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    if (isSchemaMissingError(error)) {
      // Migration ainda não foi aplicada — fallback pro mock
      return mockListFallback(filter);
    }
    throw error;
  }

  const rows = ((data as SupabaseRow[]) ?? []).map(mapRowToListItem);

  // Ordem custom: scheduled primeiro, depois starts_at desc
  rows.sort((a, b) => {
    if (a.status === "scheduled" && b.status !== "scheduled") return -1;
    if (b.status === "scheduled" && a.status !== "scheduled") return 1;
    return b.starts_at.localeCompare(a.starts_at);
  });

  return rows;
}

/**
 * Mock fallback — usado quando a migration ainda não foi aplicada.
 * Quando dados reais existirem, esse caminho não é mais executado.
 */
function mockListFallback(filter: ListMeetingsFilter): MeetingListItem[] {
  let rows = [...MOCK_MEETINGS];

  if (filter.status && filter.status !== "todos") {
    rows = rows.filter((m) => m.status === filter.status);
  }
  if (filter.ownerUserId) {
    rows = rows.filter((m) => m.owner_user_id === filter.ownerUserId);
  }
  if (filter.searchQuery && filter.searchQuery.trim()) {
    const q = filter.searchQuery.trim().toLowerCase();
    rows = rows.filter(
      (m) =>
        m.titulo.toLowerCase().includes(q) ||
        m.owner_nome.toLowerCase().includes(q) ||
        (m.resumo_preview ?? "").toLowerCase().includes(q) ||
        m.tags.some((t) => t.includes(q)),
    );
  }
  if (filter.desde) rows = rows.filter((m) => m.starts_at >= filter.desde!);
  if (filter.ate) rows = rows.filter((m) => m.starts_at <= filter.ate!);

  rows.sort((a, b) => {
    if (a.status === "scheduled" && b.status !== "scheduled") return -1;
    if (b.status === "scheduled" && a.status !== "scheduled") return 1;
    return b.starts_at.localeCompare(a.starts_at);
  });

  return rows;
}

export async function listMeetings(filter: ListMeetingsFilter = {}): Promise<MeetingListItem[]> {
  const cached = unstable_cache(
    async (filterJson: string) => _listMeetingsImpl(JSON.parse(filterJson) as ListMeetingsFilter),
    ["meetings-list-v2"],
    { revalidate: 60, tags: [MEETINGS_CACHE_TAG] },
  );
  return cached(JSON.stringify(filter));
}

export async function getMeetingById(id: string): Promise<MeetingDetail | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data, error } = await sb
    .from("meetings")
    .select(`
      id, titulo, descricao, status, source, starts_at, ends_at, duracao_segundos,
      owner_user_id, lead_id, client_id, tags, external_url,
      recording_ready, transcript_ready, summary_ready, insights_ready,
      owner:profiles!meetings_owner_user_id_fkey(nome, avatar_url),
      lead:leads!meetings_lead_id_fkey(nome_prospect),
      client:clients!meetings_client_id_fkey(nome),
      participantes:meeting_participants(*),
      recording:meeting_recordings(*),
      transcript:meeting_transcripts(*),
      summary:meeting_summaries(*),
      extracted_tasks:meeting_extracted_tasks(*),
      processing_jobs:meeting_processing_jobs(step, status, last_error, finished_at)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    if (isSchemaMissingError(error)) {
      return getMockMeetingById(id);
    }
    throw error;
  }
  if (!data) return null;

  // Mapeamento simplificado — quando dados reais começarem a entrar, refinar tipagem.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any as MeetingDetail;
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

export async function getMeetingMetrics(): Promise<MeetingMetrics> {
  // Por enquanto agregamos no app a partir da lista (volume baixo).
  // Quando passar de ~500 reuniões/org, mover pra view materialized no DB.
  const rows = await listMeetings();

  const porColaboradorMap = new Map<string, { nome: string; quantidade: number; duracao_segundos: number }>();
  const porStatus: Record<MeetingStatus, number> = {
    scheduled: 0, in_progress: 0, processing: 0, completed: 0, failed: 0, cancelled: 0,
  };
  const porDiaSemana = Array.from({ length: 7 }, (_, i) => ({ dia: i, total: 0 }));
  const tagsMap = new Map<string, number>();
  let totalDuracao = 0;
  let tasksGeradas = 0;

  for (const m of rows) {
    porStatus[m.status]++;
    if (m.duracao_segundos) totalDuracao += m.duracao_segundos;
    tasksGeradas += m.tasks_geradas_count;

    const cur = porColaboradorMap.get(m.owner_user_id) ?? {
      nome: m.owner_nome, quantidade: 0, duracao_segundos: 0,
    };
    cur.quantidade += 1;
    cur.duracao_segundos += m.duracao_segundos ?? 0;
    porColaboradorMap.set(m.owner_user_id, cur);

    const dia = new Date(m.starts_at).getDay();
    porDiaSemana[dia].total += 1;

    for (const t of m.tags) {
      tagsMap.set(t, (tagsMap.get(t) ?? 0) + 1);
    }
  }

  const porColaborador = [...porColaboradorMap.entries()]
    .map(([user_id, v]) => ({ user_id, ...v }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const topTags = [...tagsMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return { total: rows.length, totalDuracaoSegundos: totalDuracao, porColaborador, porStatus, porDiaSemana, topTags, tasksGeradas };
}

export interface GoogleConnectionInfo {
  connected: boolean;
  google_email: string | null;
  scopes: string[];
  calendar_last_synced_at: string | null;
}

/**
 * Verifica se o user tem conexão Google ativa.
 */
export async function getGoogleConnection(userId: string): Promise<GoogleConnectionInfo> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data, error } = await sb
    .from("google_oauth_connections")
    .select("google_email, scopes, calendar_last_synced_at, ativa")
    .eq("user_id", userId)
    .eq("ativa", true)
    .maybeSingle();

  if (error) {
    if (isSchemaMissingError(error)) {
      return { connected: false, google_email: null, scopes: [], calendar_last_synced_at: null };
    }
    throw error;
  }

  if (!data) {
    return { connected: false, google_email: null, scopes: [], calendar_last_synced_at: null };
  }

  const row = data as {
    google_email: string;
    scopes: string[];
    calendar_last_synced_at: string | null;
    ativa: boolean;
  };

  return {
    connected: true,
    google_email: row.google_email,
    scopes: row.scopes,
    calendar_last_synced_at: row.calendar_last_synced_at,
  };
}

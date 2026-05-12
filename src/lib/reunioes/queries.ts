// Queries do módulo Reuniões.
//
// Fase 0: retorna mock data. Quando a Fase 1 entrar, troca o body destas
// funções por queries Supabase reais. O contrato exposto (signature +
// return type) é estável — UI não muda.

import { unstable_cache } from "next/cache";
import { MOCK_MEETINGS, getMockMeetingById } from "./mock-data";
import type { MeetingDetail, MeetingListItem, MeetingStatus } from "./tipos";

export const MEETINGS_CACHE_TAG = "meetings" as const;

export interface ListMeetingsFilter {
  status?: MeetingStatus | "todos";
  ownerUserId?: string;
  searchQuery?: string;
  desde?: string;
  ate?: string;
}

async function _listMeetingsImpl(filter: ListMeetingsFilter): Promise<MeetingListItem[]> {
  // TODO Fase 1: substituir por SELECT real em `meetings`.
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

  // Ordem: futuras primeiro (status='scheduled'), depois mais recentes
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
    ["meetings-list"],
    { revalidate: 60, tags: [MEETINGS_CACHE_TAG] },
  );
  return cached(JSON.stringify(filter));
}

export async function getMeetingById(id: string): Promise<MeetingDetail | null> {
  // TODO Fase 1: substituir por JOINs reais.
  return getMockMeetingById(id);
}

export interface MeetingMetrics {
  total: number;
  totalDuracaoSegundos: number;
  porColaborador: Array<{ nome: string; user_id: string; quantidade: number; duracao_segundos: number }>;
  porStatus: Record<MeetingStatus, number>;
  porDiaSemana: Array<{ dia: number; total: number }>;
  /** Top tags. */
  topTags: Array<{ tag: string; count: number }>;
  tasksGeradas: number;
}

export async function getMeetingMetrics(): Promise<MeetingMetrics> {
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

/**
 * Retorna se o usuário já conectou conta Google. STUB — Fase 1 troca por
 * SELECT em google_oauth_connections.
 */
export async function getGoogleConnection(_userId: string): Promise<{
  connected: false;
  google_email: null;
  scopes: never[];
} | {
  connected: true;
  google_email: string;
  scopes: string[];
}> {
  void _userId;
  return { connected: false, google_email: null, scopes: [] };
}

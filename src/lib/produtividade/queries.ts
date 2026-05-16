// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { EventType } from "./schema";
import {
  ATIVO_WINDOW_SECONDS,
  HORAS_UTEIS_MES,
  ONLINE_WINDOW_SECONDS,
  SESSAO_GAP_SECONDS,
} from "./schema";

export interface ColaboradorStatusRow {
  user_id: string;
  nome: string;
  role: string;
  avatar_url: string | null;
  last_seen_at: string | null;
  last_active_event_at: string | null;
  /** Online = heartbeat < 2 min */
  online: boolean;
  /** Ativo = evento real < 5 min */
  ativo: boolean;
  /** Tempo ativo hoje em segundos (soma das sessões de eventos). */
  tempo_ativo_seg_hoje: number;
  /** Eventos hoje. */
  eventos_hoje: number;
  /** Custo/hora calculado dinamicamente. Null se sem dados de fixo+comissão. */
  custo_hora: number | null;
  /** Custo do dia: custo_hora × (tempo_ativo_seg_hoje / 3600). */
  custo_dia: number | null;
}

interface ProfileRow {
  id: string;
  nome: string;
  role: string;
  avatar_url: string | null;
  last_seen_at: string | null;
  last_active_event_at: string | null;
  fixo_mensal: number | null;
}

interface CommissionRow {
  user_id: string;
  valor_total: number | string | null;
  mes_referencia: string;
  status: string;
}

interface EventRow {
  user_id: string;
  created_at: string;
}

/** Retorna o status atual de cada colaborador ativo: online, tempo ativo
 *  hoje, eventos hoje, custo do dia. Base do dashboard /produtividade. */
export async function getColaboradoresStatus(): Promise<ColaboradorStatusRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const now = Date.now();
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Cuiaba" }),
  );
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  // Últimos 3 meses de commission_snapshots pra média
  const tresMesesAtras = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const mesAtras = `${tresMesesAtras.getFullYear()}-${String(tresMesesAtras.getMonth() + 1).padStart(2, "0")}`;

  const [{ data: profilesData }, { data: commissionData }, { data: eventsData }] =
    await Promise.all([
      sb
        .from("profiles")
        .select(
          "id, nome, role, avatar_url, last_seen_at, last_active_event_at, fixo_mensal",
        )
        .eq("ativo", true)
        .neq("role", "cliente")
        .order("nome"),
      sb
        .from("commission_snapshots")
        .select("user_id, valor_total, mes_referencia, status")
        .gte("mes_referencia", mesAtras)
        .in("status", ["paid", "approved"]),
      sb
        .from("activity_events")
        .select("user_id, created_at")
        .gte("created_at", todayIso)
        .order("created_at", { ascending: true }),
    ]);

  const profiles = (profilesData ?? []) as ProfileRow[];
  const commissions = (commissionData ?? []) as CommissionRow[];
  const events = (eventsData ?? []) as EventRow[];

  // Agrega comissão por user_id (média dos últimos 3 meses)
  const commissionByUser = new Map<string, { soma: number; n: number }>();
  for (const c of commissions) {
    const v = c.valor_total !== null ? Number(c.valor_total) : 0;
    const cur = commissionByUser.get(c.user_id) ?? { soma: 0, n: 0 };
    cur.soma += v;
    cur.n += 1;
    commissionByUser.set(c.user_id, cur);
  }

  // Agrega eventos por user_id e calcula tempo ativo via sessões
  const eventsByUser = new Map<string, EventRow[]>();
  for (const e of events) {
    const arr = eventsByUser.get(e.user_id) ?? [];
    arr.push(e);
    eventsByUser.set(e.user_id, arr);
  }

  function tempoAtivoFromEvents(evs: EventRow[]): number {
    if (evs.length === 0) return 0;
    let total = 0;
    let sessionStart = new Date(evs[0].created_at).getTime();
    let lastEvent = sessionStart;
    for (let i = 1; i < evs.length; i++) {
      const t = new Date(evs[i].created_at).getTime();
      if (t - lastEvent > SESSAO_GAP_SECONDS * 1000) {
        // Fecha sessão anterior (+ buffer mínimo de 30s pra eventos isolados)
        total += Math.max(lastEvent - sessionStart, 30 * 1000);
        sessionStart = t;
      }
      lastEvent = t;
    }
    total += Math.max(lastEvent - sessionStart, 30 * 1000);
    return Math.floor(total / 1000);
  }

  return profiles.map((p) => {
    const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    const lastActive = p.last_active_event_at
      ? new Date(p.last_active_event_at).getTime()
      : 0;
    const online = lastSeen > 0 && now - lastSeen < ONLINE_WINDOW_SECONDS * 1000;
    const ativo = lastActive > 0 && now - lastActive < ATIVO_WINDOW_SECONDS * 1000;

    const userEvents = eventsByUser.get(p.id) ?? [];
    const tempo_ativo_seg_hoje = tempoAtivoFromEvents(userEvents);

    const fixo = p.fixo_mensal !== null ? Number(p.fixo_mensal) : 0;
    const com = commissionByUser.get(p.id);
    const mediaComissao = com && com.n > 0 ? com.soma / com.n : 0;
    const custoMensal = fixo + mediaComissao;
    const custo_hora = custoMensal > 0 ? Number((custoMensal / HORAS_UTEIS_MES).toFixed(2)) : null;
    const custo_dia =
      custo_hora !== null
        ? Number(((tempo_ativo_seg_hoje / 3600) * custo_hora).toFixed(2))
        : null;

    return {
      user_id: p.id,
      nome: p.nome,
      role: p.role,
      avatar_url: p.avatar_url,
      last_seen_at: p.last_seen_at,
      last_active_event_at: p.last_active_event_at,
      online,
      ativo,
      tempo_ativo_seg_hoje,
      eventos_hoje: userEvents.length,
      custo_hora,
      custo_dia,
    };
  });
}

export interface ProdutividadeSummary {
  total_colaboradores: number;
  online_agora: number;
  ativos_agora: number;
  tempo_ativo_total_seg_hoje: number;
  eventos_hoje: number;
  custo_dia_total: number;
  custo_hora_medio: number | null;
}

export function summarizeStatus(rows: ColaboradorStatusRow[]): ProdutividadeSummary {
  const online_agora = rows.filter((r) => r.online).length;
  const ativos_agora = rows.filter((r) => r.ativo).length;
  const tempo_ativo_total_seg_hoje = rows.reduce(
    (acc, r) => acc + r.tempo_ativo_seg_hoje,
    0,
  );
  const eventos_hoje = rows.reduce((acc, r) => acc + r.eventos_hoje, 0);
  const custo_dia_total = rows.reduce((acc, r) => acc + (r.custo_dia ?? 0), 0);
  const comCusto = rows.filter((r) => r.custo_hora !== null);
  const custo_hora_medio =
    comCusto.length > 0
      ? Number(
          (
            comCusto.reduce((acc, r) => acc + (r.custo_hora ?? 0), 0) /
            comCusto.length
          ).toFixed(2),
        )
      : null;

  return {
    total_colaboradores: rows.length,
    online_agora,
    ativos_agora,
    tempo_ativo_total_seg_hoje,
    eventos_hoje,
    custo_dia_total: Number(custo_dia_total.toFixed(2)),
    custo_hora_medio,
  };
}

export interface RecentEventRow {
  id: string;
  user_id: string;
  user_nome: string;
  event_type: EventType;
  entity_type: string | null;
  client_nome: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Eventos recentes pra feed do dashboard. Limit configurável (default 30). */
export async function listRecentEvents(limit = 30): Promise<RecentEventRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("activity_events")
    .select(
      "id, user_id, event_type, entity_type, client_id, metadata, created_at, user:profiles!activity_events_user_id_fkey(nome), cliente:clients(nome)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    event_type: EventType;
    entity_type: string | null;
    client_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    user?: { nome: string } | null;
    cliente?: { nome: string } | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user_nome: r.user?.nome ?? "(usuário removido)",
    event_type: r.event_type,
    entity_type: r.entity_type,
    client_nome: r.cliente?.nome ?? null,
    metadata: r.metadata ?? {},
    created_at: r.created_at,
  }));
}

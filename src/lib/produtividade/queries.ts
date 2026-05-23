// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { EventType } from "./schema";
import {
  ATIVO_WINDOW_SECONDS,
  HORAS_UTEIS_MES,
  ONLINE_WINDOW_SECONDS,
  SESSAO_GAP_SECONDS,
} from "./schema";
import { formatIsoDate, getAppTimezoneOffsetMs } from "@/lib/datetime/timezone";

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
  /** Quanto desse tempo veio de captação externa (videomaker). */
  tempo_externo_seg_hoje: number;
  /** Eventos hoje. */
  eventos_hoje: number;
  /** Tarefas atrasadas atribuídas (status != concluida, due_date < hoje). */
  tarefas_atrasadas: number;
  /** Capturas atrasadas (videomaker passou da deadline D+1 09h). */
  capturas_atrasadas: number;
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

interface VideomakerCaptureRow {
  videomaker_assigned_id: string;
  inicio: string;
  fim: string;
  videomaker_status: string;
}

interface OverdueTaskRow {
  atribuido_a: string;
}

interface OverdueCaptureRow {
  videomaker_assigned_id: string;
  inicio: string;
  id: string;
}

/**
 * Calcula deadline de captura (D+1 09h no fuso da app). Mesmo critério que
 * `audiovisual/queries.ts` — videomaker precisa entregar antes disso.
 */
function captureDeadline(inicioIso: string): Date {
  const inicio = new Date(inicioIso);
  const deadline = new Date(inicio);
  deadline.setUTCDate(deadline.getUTCDate() + 1);
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  deadline.setUTCHours(9 + offsetHours, 0, 0, 0);
  return deadline;
}

/** Retorna o status atual de cada colaborador ativo: online, tempo ativo
 *  hoje, eventos hoje, custo do dia, atrasados. Base do dashboard /produtividade. */
export async function getColaboradoresStatus(): Promise<ColaboradorStatusRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const now = Date.now();
  // Data de hoje no fuso da app (Cuiabá). `event_date` é uma coluna `date`
  // calculada server-side com `now() at time zone 'America/Cuiaba'`, então
  // filtrar por igualdade resolve o boundary corretamente.
  const today = formatIsoDate(new Date());
  // Início/fim do dia em UTC pra queries de calendar_events.
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const todayStartUtc = new Date(`${today}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = formatIsoDate(tomorrowDate);
  const tomorrowStartUtc = new Date(`${tomorrow}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();

  // Últimos 3 meses de commission_snapshots pra média
  const tresMesesAtras = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const mesAtras = `${tresMesesAtras.getFullYear()}-${String(tresMesesAtras.getMonth() + 1).padStart(2, "0")}`;

  const [
    { data: profilesData, error: profilesError },
    { data: commissionData },
    { data: eventsData },
    { data: capturesData },
    { data: overdueTasksData },
    { data: scheduledCapturesData },
    { data: capturesEntregasData },
  ] = await Promise.all([
    // O filtro antigo `.neq("role", "cliente")` quebrava a query inteira:
    // "cliente" não existe no enum `user_role`, então Postgres rejeitava com
    // "invalid input value for enum". Resultado: profilesData=null, página
    // toda zerava. Removido (não havia perfis com role=cliente mesmo —
    // clientes ficam em `clients`, não em `profiles`).
    sb
      .from("profiles")
      .select(
        "id, nome, role, avatar_url, last_seen_at, last_active_event_at, fixo_mensal",
      )
      .eq("ativo", true)
      .order("nome"),
    sb
      .from("commission_snapshots")
      .select("user_id, valor_total, mes_referencia, status")
      .gte("mes_referencia", mesAtras)
      .in("status", ["paid", "approved"]),
    sb
      .from("activity_events")
      .select("user_id, created_at")
      .eq("event_date", today)
      .order("created_at", { ascending: true }),
    // Capturas externas de videomaker que aconteceram hoje (conta como tempo produtivo)
    sb
      .from("calendar_events")
      .select("videomaker_assigned_id, inicio, fim, videomaker_status")
      .eq("sub_calendar", "videomakers")
      .in("videomaker_status", ["scheduled", "completed"])
      .gte("inicio", todayStartUtc)
      .lt("inicio", tomorrowStartUtc)
      .not("videomaker_assigned_id", "is", null),
    // Tarefas atrasadas (não concluídas, due_date < hoje)
    sb
      .from("tasks")
      .select("atribuido_a")
      .neq("status", "concluida")
      .lt("due_date", today)
      .not("due_date", "is", null),
    // Capturas potencialmente atrasadas: scheduled, no passado, deadline pode ter passado
    sb
      .from("calendar_events")
      .select("id, videomaker_assigned_id, inicio")
      .eq("sub_calendar", "videomakers")
      .eq("videomaker_status", "scheduled")
      .lt("inicio", new Date(now).toISOString())
      .not("videomaker_assigned_id", "is", null)
      .gte("inicio", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()),
    // Capturas já entregues — pra excluir de atrasadas
    sb
      .from("audiovisual_capturas")
      .select("event_id")
      .not("event_id", "is", null),
  ]);

  if (profilesError) {
    console.error("[produtividade/queries] profiles select failed:", profilesError);
  }
  const profiles = (profilesData ?? []) as ProfileRow[];
  const commissions = (commissionData ?? []) as CommissionRow[];
  const events = (eventsData ?? []) as EventRow[];
  const captures = (capturesData ?? []) as VideomakerCaptureRow[];
  const overdueTasks = (overdueTasksData ?? []) as OverdueTaskRow[];
  const scheduledCaptures = (scheduledCapturesData ?? []) as OverdueCaptureRow[];
  const entregasEventIds = new Set(
    ((capturesEntregasData ?? []) as Array<{ event_id: string | null }>)
      .map((c) => c.event_id)
      .filter((id): id is string => id !== null),
  );

  // Agrega comissão por user_id (média dos últimos 3 meses)
  const commissionByUser = new Map<string, { soma: number; n: number }>();
  for (const c of commissions) {
    const v = c.valor_total !== null ? Number(c.valor_total) : 0;
    const cur = commissionByUser.get(c.user_id) ?? { soma: 0, n: 0 };
    cur.soma += v;
    cur.n += 1;
    commissionByUser.set(c.user_id, cur);
  }

  // Eventos por user_id pra cálculo de sessões
  const eventsByUser = new Map<string, EventRow[]>();
  for (const e of events) {
    const arr = eventsByUser.get(e.user_id) ?? [];
    arr.push(e);
    eventsByUser.set(e.user_id, arr);
  }

  // Tempo de captação externa por videomaker (segundos)
  const tempoExternoByUser = new Map<string, number>();
  for (const c of captures) {
    if (!c.videomaker_assigned_id) continue;
    const dur = Math.max(
      0,
      Math.floor((new Date(c.fim).getTime() - new Date(c.inicio).getTime()) / 1000),
    );
    tempoExternoByUser.set(
      c.videomaker_assigned_id,
      (tempoExternoByUser.get(c.videomaker_assigned_id) ?? 0) + dur,
    );
  }

  // Tarefas atrasadas por user_id
  const tarefasAtrasadasByUser = new Map<string, number>();
  for (const t of overdueTasks) {
    tarefasAtrasadasByUser.set(
      t.atribuido_a,
      (tarefasAtrasadasByUser.get(t.atribuido_a) ?? 0) + 1,
    );
  }

  // Capturas atrasadas por videomaker (deadline passou + sem entrega)
  const capturasAtrasadasByUser = new Map<string, number>();
  for (const c of scheduledCaptures) {
    if (entregasEventIds.has(c.id)) continue;
    if (new Date(now) <= captureDeadline(c.inicio)) continue;
    capturasAtrasadasByUser.set(
      c.videomaker_assigned_id,
      (capturasAtrasadasByUser.get(c.videomaker_assigned_id) ?? 0) + 1,
    );
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
    const tempoEventos = tempoAtivoFromEvents(userEvents);
    const tempoExterno = tempoExternoByUser.get(p.id) ?? 0;
    const tempo_ativo_seg_hoje = tempoEventos + tempoExterno;

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
      tempo_externo_seg_hoje: tempoExterno,
      eventos_hoje: userEvents.length,
      tarefas_atrasadas: tarefasAtrasadasByUser.get(p.id) ?? 0,
      capturas_atrasadas: capturasAtrasadasByUser.get(p.id) ?? 0,
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
  tarefas_atrasadas_total: number;
  capturas_atrasadas_total: number;
  colaboradores_com_atraso: number;
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
  const tarefas_atrasadas_total = rows.reduce((acc, r) => acc + r.tarefas_atrasadas, 0);
  const capturas_atrasadas_total = rows.reduce((acc, r) => acc + r.capturas_atrasadas, 0);
  const colaboradores_com_atraso = rows.filter(
    (r) => r.tarefas_atrasadas + r.capturas_atrasadas > 0,
  ).length;
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
    tarefas_atrasadas_total,
    capturas_atrasadas_total,
    colaboradores_com_atraso,
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

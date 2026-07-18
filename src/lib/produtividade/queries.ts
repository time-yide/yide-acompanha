// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { EventType } from "./schema";
import {
  ATIVO_WINDOW_SECONDS,
  DIAS_UTEIS_MES,
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
  /** Custo/hora do salário fixo: fixo_mensal ÷ 176h. Null se sem fixo. */
  custo_hora: number | null;
  /**
   * Custo do salário fixo no período: (fixo_mensal ÷ dias úteis do mês) ×
   * dias úteis decorridos no range. É o que se paga de fato, independente
   * de atividade. Null quando não há fixo cadastrado.
   */
  custo_periodo: number | null;
  /** Entregas no período: tarefas que viraram "postada" no range. */
  entregas_periodo: number;
  /**
   * Custo por entrega: custo_periodo ÷ entregas_periodo. Quanto de salário
   * fixo cada entrega custou. Null quando não há custo ou 0 entregas.
   */
  custo_por_entrega: number | null;
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

interface DeliveryRow {
  atribuido_a: string;
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
 * `audiovisual/queries.ts` - videomaker precisa entregar antes disso.
 */
function captureDeadline(inicioIso: string): Date {
  const inicio = new Date(inicioIso);
  const deadline = new Date(inicio);
  deadline.setUTCDate(deadline.getUTCDate() + 1);
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  deadline.setUTCHours(9 + offsetHours, 0, 0, 0);
  return deadline;
}

export type PeriodoRange = "dia" | "semana" | "mes";

export const PERIODO_LABEL: Record<PeriodoRange, string> = {
  dia: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
};

/**
 * Conta dias úteis (segunda a sexta) entre `since` e `today` inclusive.
 * Ambas as datas em formato YYYY-MM-DD no fuso da app.
 */
function diasUteisDecorridos(sinceIso: string, todayIso: string): number {
  const [sy, sm, sd] = sinceIso.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ty, tm - 1, td);
  if (end < start) return 0;
  let count = 0;
  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    const dow = new Date(t).getUTCDay(); // 0=dom..6=sab
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

/**
 * Calcula `since` (YYYY-MM-DD em Cuiabá) pro range pedido. Usa calendário:
 *   - dia: hoje
 *   - semana: segunda-feira da semana atual
 *   - mes: dia 1 do mês atual
 */
function computeSince(range: PeriodoRange, todayIso: string): string {
  if (range === "dia") return todayIso;
  // todayIso é "YYYY-MM-DD" no fuso de Cuiabá; parseando como UTC dá uma data
  // estável pra fazer aritmética. Pega weekday/mês em UTC mesmo (sem TZ
  // shift) porque a string já está no fuso correto.
  const [yyyy, mm, dd] = todayIso.split("-").map(Number);
  const todayDate = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (range === "mes") {
    return `${yyyy}-${String(mm).padStart(2, "0")}-01`;
  }
  // semana: segunda-feira. getUTCDay: 0=Dom..6=Sáb. Queremos diff até segunda (1).
  const weekday = todayDate.getUTCDay();
  const diffParaSegunda = weekday === 0 ? 6 : weekday - 1;
  const segunda = new Date(todayDate);
  segunda.setUTCDate(segunda.getUTCDate() - diffParaSegunda);
  const sy = segunda.getUTCFullYear();
  const sm = String(segunda.getUTCMonth() + 1).padStart(2, "0");
  const sd = String(segunda.getUTCDate()).padStart(2, "0");
  return `${sy}-${sm}-${sd}`;
}

/** Retorna o status de cada colaborador ativo no período pedido: tempo ativo,
 *  eventos, custo. `online/ativo` e `atrasados` são sempre estado atual
 *  (não dependem do range). */
export async function getColaboradoresStatus(
  range: PeriodoRange = "dia",
): Promise<ColaboradorStatusRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const now = Date.now();
  // `event_date` é coluna `date` calculada server-side com
  // `now() at time zone 'America/Cuiaba'` - filtrar por igualdade (1 dia) ou
  // gte (semana/mês) resolve o boundary de timezone corretamente.
  const today = formatIsoDate(new Date());
  const since = computeSince(range, today);
  // Início/fim do range em UTC pra queries de calendar_events.
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const sinceStartUtc = new Date(`${since}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = formatIsoDate(tomorrowDate);
  const tomorrowStartUtc = new Date(`${tomorrow}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();

  const [
    { data: profilesData, error: profilesError },
    { data: presenceData, error: presenceError },
    { data: eventsData },
    { data: capturesData },
    { data: entregasData },
    { data: overdueTasksData },
    { data: scheduledCapturesData },
    { data: capturesEntregasData },
  ] = await Promise.all([
    // O filtro antigo `.neq("role", "cliente")` quebrava a query inteira:
    // "cliente" não existe no enum `user_role`, então Postgres rejeitava com
    // "invalid input value for enum". Resultado: profilesData=null, página
    // toda zerava. Removido (não havia perfis com role=cliente mesmo -
    // clientes ficam em `clients`, não em `profiles`).
    sb
      .from("profiles")
      .select(
        "id, nome, role, avatar_url, last_seen_at, last_active_event_at, fixo_mensal",
      )
      .eq("ativo", true)
      .order("nome"),
    // Tempo ativo real = presença por heartbeat, agregada em Postgres (segundos
    // por user). Se a migration ainda não rodou, a RPC não existe e cai no
    // fallback de eventos abaixo (presenceError !== null).
    sb.rpc("presence_seconds_by_user", {
      p_since: sinceStartUtc,
      p_until: tomorrowStartUtc,
    }),
    // Eventos do período: contagem exibida + fallback de tempo ativo pré-migration.
    sb
      .from("activity_events")
      .select("user_id, created_at")
      .gte("event_date", since)
      .lte("event_date", today)
      .order("created_at", { ascending: true }),
    // Capturas externas de videomaker no período (conta como tempo produtivo)
    sb
      .from("calendar_events")
      .select("videomaker_assigned_id, inicio, fim, videomaker_status")
      .eq("sub_calendar", "videomakers")
      .in("videomaker_status", ["scheduled", "completed"])
      .gte("inicio", sinceStartUtc)
      .lt("inicio", tomorrowStartUtc)
      .not("videomaker_assigned_id", "is", null),
    // Entregas no período: tarefas que viraram "postada" (completed_at é
    // carimbado no momento em que vira postada — ver tarefas/actions.ts).
    sb
      .from("tasks")
      .select("atribuido_a")
      .eq("status", "postada")
      .gte("completed_at", sinceStartUtc)
      .lt("completed_at", tomorrowStartUtc)
      .not("atribuido_a", "is", null),
    // Tarefas atrasadas — MESMA definição de countOverdueTasksForUser
    // (tarefas/queries.ts): prazo vencido, não deletada/arquivada e ainda não
    // finalizada. Exclui "concluida" (pessoa já entregou) e "postada", e ignora
    // tarefas com deleted_at — senão o contador infla com tarefas mortas/antigas.
    sb
      .from("tasks")
      .select("atribuido_a")
      .is("deleted_at", null)
      .not("status", "in", "(concluida,postada)")
      .lt("due_date", today)
      .not("atribuido_a", "is", null),
    // Capturas potencialmente atrasadas: scheduled, no passado, deadline pode ter passado
    sb
      .from("calendar_events")
      .select("id, videomaker_assigned_id, inicio")
      .eq("sub_calendar", "videomakers")
      .eq("videomaker_status", "scheduled")
      .lt("inicio", new Date(now).toISOString())
      .not("videomaker_assigned_id", "is", null)
      .gte("inicio", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()),
    // Capturas já entregues - pra excluir de atrasadas
    sb
      .from("audiovisual_capturas")
      .select("event_id")
      .not("event_id", "is", null),
  ]);

  if (profilesError) {
    console.error("[produtividade/queries] profiles select failed:", profilesError);
  }
  const profiles = (profilesData ?? []) as ProfileRow[];
  const events = (eventsData ?? []) as EventRow[];
  const captures = (capturesData ?? []) as VideomakerCaptureRow[];
  const entregas = (entregasData ?? []) as DeliveryRow[];
  const overdueTasks = (overdueTasksData ?? []) as OverdueTaskRow[];
  const scheduledCaptures = (scheduledCapturesData ?? []) as OverdueCaptureRow[];
  const entregasEventIds = new Set(
    ((capturesEntregasData ?? []) as Array<{ event_id: string | null }>)
      .map((c) => c.event_id)
      .filter((id): id is string => id !== null),
  );

  // Dias úteis decorridos no período (seg–sex). Base do custo do salário fixo:
  // (fixo ÷ dias úteis do mês) × dias decorridos. Pra "dia" dá 1; "semana"/
  // "mes" variam com o calendário.
  const diasUteis = diasUteisDecorridos(since, today);

  // Tempo ativo real = presença por heartbeat (segundos por user), agregada em
  // Postgres. Se a RPC não existir ainda (migration manual pendente),
  // presenceError vem preenchido e caímos no fallback de eventos.
  const presenceAvailable = !presenceError;
  if (presenceError) {
    console.error(
      "[produtividade/queries] presence_seconds_by_user indisponível — fallback de eventos:",
      presenceError,
    );
  }
  const presenceByUser = new Map<string, number>();
  for (const p of (presenceData ?? []) as Array<{
    user_id: string;
    seconds: number | string | null;
  }>) {
    presenceByUser.set(p.user_id, p.seconds !== null ? Number(p.seconds) : 0);
  }

  // Entregas por user_id (tarefas postadas no período)
  const entregasByUser = new Map<string, number>();
  for (const t of entregas) {
    entregasByUser.set(
      t.atribuido_a,
      (entregasByUser.get(t.atribuido_a) ?? 0) + 1,
    );
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
    // Presença real do heartbeat. Sem a migration, presenceAvailable=false e
    // usamos a reconstrução por eventos (pior, mas não quebra a página).
    const tempoPresenca = presenceAvailable
      ? (presenceByUser.get(p.id) ?? 0)
      : tempoAtivoFromEvents(userEvents);
    const tempoExterno = tempoExternoByUser.get(p.id) ?? 0;
    const tempo_ativo_seg_hoje = tempoPresenca + tempoExterno;

    // Custo = salário fixo real. custo/hora = fixo ÷ 176h; custo do período =
    // (fixo ÷ dias úteis do mês) × dias úteis decorridos. Independe da atividade.
    const fixo = p.fixo_mensal !== null ? Number(p.fixo_mensal) : 0;
    const custo_hora = fixo > 0 ? Number((fixo / HORAS_UTEIS_MES).toFixed(2)) : null;
    const custo_periodo =
      fixo > 0
        ? Number(((fixo / DIAS_UTEIS_MES) * diasUteis).toFixed(2))
        : null;

    const entregas_periodo = entregasByUser.get(p.id) ?? 0;
    const custo_por_entrega =
      custo_periodo !== null && entregas_periodo > 0
        ? Number((custo_periodo / entregas_periodo).toFixed(2))
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
      custo_periodo,
      entregas_periodo,
      custo_por_entrega,
    };
  });
}

export interface ProdutividadeSummary {
  total_colaboradores: number;
  online_agora: number;
  ativos_agora: number;
  tempo_ativo_total_seg_hoje: number;
  eventos_hoje: number;
  /** Custo do salário fixo do time no período (soma dos custo_periodo). */
  custo_periodo_total: number;
  /** Custo/hora médio (só quem tem fixo cadastrado). */
  custo_hora_medio: number | null;
  /** Entregas do time no período (tarefas postadas). */
  entregas_total: number;
  /**
   * Custo por entrega agregado: custo_periodo_total ÷ entregas_total. Quanto de
   * salário fixo cada entrega custou no período. Null se 0 entregas ou 0 custo.
   */
  custo_por_entrega: number | null;
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
  const custo_periodo_total = rows.reduce((acc, r) => acc + (r.custo_periodo ?? 0), 0);
  const entregas_total = rows.reduce((acc, r) => acc + r.entregas_periodo, 0);
  const custo_por_entrega =
    entregas_total > 0 && custo_periodo_total > 0
      ? Number((custo_periodo_total / entregas_total).toFixed(2))
      : null;
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
    custo_periodo_total: Number(custo_periodo_total.toFixed(2)),
    custo_hora_medio,
    entregas_total,
    custo_por_entrega,
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

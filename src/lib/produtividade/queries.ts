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
import { isTarefaAtrasadaParaCargo } from "@/lib/tarefas/overdue-rules";
import {
  computePrazoAgilidade,
  resumoPrazoAgilidade,
  type PrazoAgilidadeRow,
  type ResumoPrazoAgilidade,
  type TaskPrazoRow,
} from "./prazo-agilidade";
import {
  computeAprovacaoDesign,
  computeRetrabalho,
  type AprovacaoRow,
  type RetrabalhoRow,
} from "./qualidade-setor";
import { computeConversao, type ConversaoRow } from "./conversao-comercial";

const DESIGN_STATUS_APROVADA = ["aprovado", "agendado", "publicado"];
import {
  aggregateEntregaMaterial,
  type EntregaMaterialStats,
  type EntregueInput,
  type PendenteInput,
} from "./entrega-material";
import {
  agregarTimeAudiovisual,
  contaComoEntrega,
  faturamentoPeriodo,
  isRoleExcluido,
  isRoleTimeAudiovisual,
  lucroPeriodo,
  receitaAtribuida,
  valorPorEntrega,
  type TimeAudiovisualAgg,
} from "./lucro";

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
  /** Entregas no período por cargo: operacional conta "concluida"/"postada",
   *  demais só "postada"; videomaker soma capturas entregues (audiovisual_capturas). */
  entregas_periodo: number;
  /**
   * Custo por entrega: custo_periodo ÷ entregas_periodo. Quanto de salário
   * fixo cada entrega custou. Null quando não há custo ou 0 entregas.
   */
  custo_por_entrega: number | null;
  /** Receita atribuída no período: valor por entrega × entregas. Null se indefinido. */
  receita_periodo: number | null;
  /** Lucro no período: receita_periodo − custo_periodo. Null se faltar parte. */
  lucro_periodo: number | null;
}

export interface TimeAudiovisualCard extends TimeAudiovisualAgg {
  coordenador_user_id: string;
  coordenador_nome: string;
}

export interface ColaboradoresStatusResult {
  /** Linhas individuais (sem coordenador geral, sócia nem o coord de audiovisual). */
  rows: ColaboradorStatusRow[];
  /** Faturamento pró-rata do período (carteira ativa ÷ 22 × dias úteis). */
  faturamento_periodo: number;
  /** Valor de 1 entrega no período. Null se 0 entregas. */
  valor_por_entrega: number | null;
  /** Card do coordenador de audiovisual medido pelo time. Null se não há coord ativo. */
  time_audiovisual: TimeAudiovisualCard | null;
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
  status: string;
}

interface EventRow {
  user_id: string;
  created_at: string;
}

interface VideomakerCaptureRow {
  videomaker_assigned_id: string | null;
  participantes_ids: string[] | null;
  inicio: string;
  fim: string;
  videomaker_status: string;
}

interface OverdueTaskRow {
  atribuido_a: string;
  status: string;
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
export function computeSince(range: PeriodoRange, todayIso: string): string {
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
): Promise<ColaboradoresStatusResult> {
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
    { data: clientsData },
    { data: capturasEntreguesData },
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
    // Gravações no período (conta como tempo produtivo pra TODOS que foram —
    // participantes_ids, não só o videomaker atribuído).
    sb
      .from("calendar_events")
      .select("videomaker_assigned_id, participantes_ids, inicio, fim, videomaker_status")
      .eq("sub_calendar", "videomakers")
      .in("videomaker_status", ["scheduled", "completed"])
      .gte("inicio", sinceStartUtc)
      .lt("inicio", tomorrowStartUtc),
    // Entregas no período: tarefas que viraram "concluida" (Concluído
    // Operacional) OU "postada". A regra POR CARGO é aplicada em JS via
    // contaComoEntrega (operacional entrega em concluida; resto só em postada).
    // completed_at é carimbado ao entrar em concluida/postada (ver tarefas/actions.ts).
    sb
      .from("tasks")
      .select("atribuido_a, status")
      .in("status", ["concluida", "postada"])
      .gte("completed_at", sinceStartUtc)
      .lt("completed_at", tomorrowStartUtc)
      .not("atribuido_a", "is", null),
    // Candidatas a atrasada: prazo vencido, não deletada, ainda não postada
    // (postada é entregue pra todo cargo). O critério final é POR CARGO —
    // aplicado em JS via isTarefaAtrasadaParaCargo (operacional entrega em
    // "concluida"; assessor/adm/etc só em "postada"). Traz status pra decidir.
    sb
      .from("tasks")
      .select("atribuido_a, status")
      .is("deleted_at", null)
      .neq("status", "postada")
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
    // Carteira mensal (MRR) — faturamento base. valor_mensal já é 0 pra
    // parceria/permuta (forçado na escrita), então soma direto os ativos.
    sb.from("clients").select("valor_mensal").eq("status", "ativo").is("deleted_at", null),
    // Capturas entregues no período (material subido) — entrega de gravação do
    // videomaker. created_at = quando subiu. Some às entregas dele.
    sb
      .from("audiovisual_capturas")
      .select("videomaker_id, created_at")
      .gte("created_at", sinceStartUtc)
      .lt("created_at", tomorrowStartUtc)
      .not("videomaker_id", "is", null),
  ]);

  if (profilesError) {
    console.error("[produtividade/queries] profiles select failed:", profilesError);
  }
  const profiles = (profilesData ?? []) as ProfileRow[];
  // Cargo por user — o critério de "atrasada" depende dele (ver overdue-rules).
  const roleByUser = new Map<string, string>(profiles.map((p) => [p.id, p.role]));
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
  // Faturamento pró-rata do período: carteira ativa ÷ 22 dias úteis × dias
  // decorridos — mesma base do custo, pra numerador e denominador baterem.
  const carteiraMensal = ((clientsData ?? []) as Array<{ valor_mensal: number | string }>)
    .reduce((acc, c) => acc + Number(c.valor_mensal), 0);
  const faturamento_periodo = faturamentoPeriodo(carteiraMensal, diasUteis, DIAS_UTEIS_MES);

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

  // Entregas por user_id. Tarefas: aplica regra por cargo (concluida p/
  // operacional; postada p/ resto). Depois soma capturas entregues (videomaker).
  const entregasByUser = new Map<string, number>();
  for (const t of entregas) {
    const role = roleByUser.get(t.atribuido_a);
    // Gestão/dona e o coord de audiovisual não produzem entrega individual —
    // ficam fora da contagem (e do denominador do valor por entrega).
    if (isRoleExcluido(role) || role === "audiovisual_chefe") continue;
    if (!contaComoEntrega(t.status, role)) continue;
    entregasByUser.set(t.atribuido_a, (entregasByUser.get(t.atribuido_a) ?? 0) + 1);
  }
  const capturasEntregues = (capturasEntreguesData ?? []) as Array<{
    videomaker_id: string;
    created_at: string;
  }>;
  // Captura e edição são entregas DISTINTAS (a do videomaker = gravação +
  // edição): capturas vivem em `audiovisual_capturas`, edições são tasks em
  // `concluida` — somar as duas é intencional, não duplica. Sem guard de cargo
  // aqui: quem não é produtor individual já é filtrado do denominador adiante.
  for (const c of capturasEntregues) {
    entregasByUser.set(c.videomaker_id, (entregasByUser.get(c.videomaker_id) ?? 0) + 1);
  }

  // Eventos por user_id pra cálculo de sessões
  const eventsByUser = new Map<string, EventRow[]>();
  for (const e of events) {
    const arr = eventsByUser.get(e.user_id) ?? [];
    arr.push(e);
    eventsByUser.set(e.user_id, arr);
  }

  // Tempo de gravação (segundos) creditado a TODOS que foram na captura. Usa
  // participantes_ids; se vier vazio, cai no videomaker atribuído.
  const tempoExternoByUser = new Map<string, number>();
  for (const c of captures) {
    const dur = Math.max(
      0,
      Math.floor((new Date(c.fim).getTime() - new Date(c.inicio).getTime()) / 1000),
    );
    if (dur === 0) continue;
    const foram =
      c.participantes_ids && c.participantes_ids.length > 0
        ? c.participantes_ids
        : c.videomaker_assigned_id
          ? [c.videomaker_assigned_id]
          : [];
    for (const uid of foram) {
      tempoExternoByUser.set(uid, (tempoExternoByUser.get(uid) ?? 0) + dur);
    }
  }

  // Tarefas atrasadas por user_id — critério por cargo (operacional entrega em
  // "concluida"; assessor/adm/etc só em "postada").
  const tarefasAtrasadasByUser = new Map<string, number>();
  for (const t of overdueTasks) {
    if (!isTarefaAtrasadaParaCargo(t.status, roleByUser.get(t.atribuido_a))) {
      continue;
    }
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

  // Passada 1: métricas base por perfil (sem receita/lucro ainda — precisam do
  // valor por entrega, que depende do total de entregas dos produtores).
  const baseRows = profiles.map((p) => {
    const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    const lastActive = p.last_active_event_at
      ? new Date(p.last_active_event_at).getTime()
      : 0;
    const online = lastSeen > 0 && now - lastSeen < ONLINE_WINDOW_SECONDS * 1000;
    const ativo = lastActive > 0 && now - lastActive < ATIVO_WINDOW_SECONDS * 1000;

    const userEvents = eventsByUser.get(p.id) ?? [];
    const tempoPresenca = presenceAvailable
      ? (presenceByUser.get(p.id) ?? 0)
      : tempoAtivoFromEvents(userEvents);
    const tempoExterno = tempoExternoByUser.get(p.id) ?? 0;
    const tempo_ativo_seg_hoje = tempoPresenca + tempoExterno;

    const fixo = p.fixo_mensal !== null ? Number(p.fixo_mensal) : 0;
    const custo_hora = fixo > 0 ? Number((fixo / HORAS_UTEIS_MES).toFixed(2)) : null;
    const custo_periodo =
      fixo > 0 ? Number(((fixo / DIAS_UTEIS_MES) * diasUteis).toFixed(2)) : null;

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
      receita_periodo: null as number | null,
      lucro_periodo: null as number | null,
    };
  });

  // Denominador do valor por entrega: entregas dos indivíduos que produzem —
  // exclui cargos de gestão/dona (coordenador, socio) e o coord de audiovisual
  // (audiovisual_chefe, que não produz direto; ele é medido pelo time).
  const individuais = baseRows.filter(
    (r) => !isRoleExcluido(r.role) && r.role !== "audiovisual_chefe",
  );
  const totalEntregas = individuais.reduce((acc, r) => acc + r.entregas_periodo, 0);
  const valor_por_entrega = valorPorEntrega(faturamento_periodo, totalEntregas);

  // Preenche receita/lucro nas linhas base (usado tanto nas individuais quanto
  // no agregado do time — produtores são um subconjunto das individuais).
  for (const r of baseRows) {
    r.receita_periodo = receitaAtribuida(valor_por_entrega, r.entregas_periodo);
    r.lucro_periodo = lucroPeriodo(r.receita_periodo, r.custo_periodo);
  }

  const rows: ColaboradorStatusRow[] = individuais;

  // Card do time audiovisual: agrega os produtores + salário do coordenador.
  const produtores = baseRows.filter((r) => isRoleTimeAudiovisual(r.role));
  const coord = baseRows.find((r) => r.role === "audiovisual_chefe");
  const time_audiovisual: TimeAudiovisualCard | null = coord
    ? {
        coordenador_user_id: coord.user_id,
        coordenador_nome: coord.nome,
        ...agregarTimeAudiovisual(produtores, coord.custo_periodo),
      }
    : null;

  return { rows, faturamento_periodo, valor_por_entrega, time_audiovisual };
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
  /** Faturamento pró-rata do período (carteira ativa). */
  faturamento_periodo: number;
  /** Receita atribuída somada das linhas individuais. */
  receita_total: number;
  /** Lucro do time individual: receita_total − custo_periodo_total. Null quando
   *  não há receita computável (sem entregas ou sem faturamento) — evita mostrar
   *  prejuízo fictício. */
  lucro_total: number | null;
  tarefas_atrasadas_total: number;
  capturas_atrasadas_total: number;
  colaboradores_com_atraso: number;
}

export function summarizeStatus(
  rows: ColaboradorStatusRow[],
  faturamento = 0,
): ProdutividadeSummary {
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
  const receita_total = Number(
    rows.reduce((acc, r) => acc + (r.receita_periodo ?? 0), 0).toFixed(2),
  );
  // custo_periodo_total trata salário ausente como 0 (custo desconhecido), então
  // o lucro do time pode ser um pouco maior que a soma dos lucros por linha
  // (linhas sem salário mostram lucro "—" mas contribuem receita aqui). Escolha
  // consciente: o agregado assume custo 0 pra quem não tem salário cadastrado.
  const lucro_total =
    receita_total === 0
      ? null
      : Number((receita_total - custo_periodo_total).toFixed(2));
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
    faturamento_periodo: Number(faturamento.toFixed(2)),
    receita_total,
    lucro_total,
    tarefas_atrasadas_total,
    capturas_atrasadas_total,
    colaboradores_com_atraso,
  };
}

export interface EntregaMaterialUserRow extends EntregaMaterialStats {
  user_id: string;
  nome: string;
  role: string;
}

/** Janela pra trás pra procurar gravações ainda não entregues (pendentes). */
const PENDENTE_JANELA_DIAS = 60;

/**
 * "Tempo pra entregar" por pessoa: turnaround entre o fim da gravação e a
 * subida do material (audiovisual_capturas.created_at). Retorna quem teve
 * entrega OU pendência no período. Independente do range de `getColaboradoresStatus`.
 */
export async function getEntregaMaterialStats(
  range: PeriodoRange = "dia",
): Promise<EntregaMaterialUserRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const today = formatIsoDate(new Date());
  const since = computeSince(range, today);
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const sinceStartUtc = new Date(`${since}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = formatIsoDate(tomorrowDate);
  const tomorrowStartUtc = new Date(`${tomorrow}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const pendenteDesdeUtc = new Date(now - PENDENTE_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: entreguesData },
    { data: pendentesEventsData },
    { data: entregasAllData },
    { data: profilesData },
  ] = await Promise.all([
    // Entregues no período (created_at = quando subiu o material)
    sb
      .from("audiovisual_capturas")
      .select("event_id, videomaker_id, created_at")
      .gte("created_at", sinceStartUtc)
      .lt("created_at", tomorrowStartUtc)
      .not("event_id", "is", null)
      .not("videomaker_id", "is", null),
    // Gravações já ocorridas (janela) candidatas a pendente de entrega
    sb
      .from("calendar_events")
      .select("id, videomaker_assigned_id, participantes_ids, inicio, fim")
      .eq("sub_calendar", "videomakers")
      .in("videomaker_status", ["scheduled", "completed"])
      .lt("inicio", nowIso)
      .gte("inicio", pendenteDesdeUtc)
      .not("videomaker_assigned_id", "is", null),
    // Todos os event_ids já entregues (pra excluir das pendentes)
    sb.from("audiovisual_capturas").select("event_id").not("event_id", "is", null),
    sb.from("profiles").select("id, nome, role").eq("ativo", true),
  ]);

  const entregues = (entreguesData ?? []) as Array<{
    event_id: string;
    videomaker_id: string;
    created_at: string;
  }>;
  const pendentesEvents = (pendentesEventsData ?? []) as Array<{
    id: string;
    videomaker_assigned_id: string;
    participantes_ids: string[] | null;
    inicio: string;
    fim: string | null;
  }>;
  const jaEntregueEventIds = new Set(
    ((entregasAllData ?? []) as Array<{ event_id: string | null }>)
      .map((e) => e.event_id)
      .filter((id): id is string => id !== null),
  );
  const profiles = (profilesData ?? []) as Array<{ id: string; nome: string; role: string }>;
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // Precisa do fim da gravação das capturas entregues (a captura só guarda a
  // data, não o horário) — busca os eventos por id.
  const entregEventIds = [...new Set(entregues.map((e) => e.event_id))];
  const fimById = new Map<string, string>();
  if (entregEventIds.length > 0) {
    const { data: eventosData } = await sb
      .from("calendar_events")
      .select("id, inicio, fim")
      .in("id", entregEventIds);
    for (const ev of (eventosData ?? []) as Array<{ id: string; inicio: string; fim: string | null }>) {
      fimById.set(ev.id, ev.fim ?? ev.inicio);
    }
  }

  const entreguesInput: EntregueInput[] = entregues
    .map((e) => {
      const ref = fimById.get(e.event_id);
      if (!ref) return null;
      return { user_id: e.videomaker_id, entrega_at: e.created_at, gravacao_ref: ref };
    })
    .filter((x): x is EntregueInput => x !== null);

  const pendentesInput: PendenteInput[] = pendentesEvents
    .filter((ev) => !jaEntregueEventIds.has(ev.id))
    .map((ev) => ({
      user_id: ev.videomaker_assigned_id,
      gravacao_ref: ev.fim ?? ev.inicio,
    }));

  const statsByUser = aggregateEntregaMaterial(entreguesInput, pendentesInput, now);

  const rows: EntregaMaterialUserRow[] = [];
  for (const [user_id, stats] of statsByUser) {
    const prof = profileById.get(user_id);
    // Pula quem não é mais perfil ativo (removido/inativo) — não mostra
    // linha "(usuário removido)" na tabela de entrega de material.
    if (!prof) continue;
    rows.push({
      user_id,
      nome: prof.nome,
      role: prof.role,
      ...stats,
    });
  }
  // Pendentes mais críticas primeiro, depois quem entregou mais.
  rows.sort(
    (a, b) =>
      b.pendentes - a.pendentes ||
      (b.pendente_mais_antiga_seg ?? 0) - (a.pendente_mais_antiga_seg ?? 0) ||
      b.entregues - a.entregues,
  );
  return rows;
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

export interface PrazoAgilidadeResult {
  pessoas: PrazoAgilidadeRow[];
  resumo: ResumoPrazoAgilidade;
}

/**
 * Prazo & agilidade das TAREFAS no período: % concluído no prazo e tempo médio
 * de entrega (criação → conclusão) por pessoa. On-time = data de conclusão <= due_date.
 */
export async function getPrazoAgilidade(range: PeriodoRange = "dia"): Promise<PrazoAgilidadeResult> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const today = formatIsoDate(new Date());
  const since = computeSince(range, today);
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const sinceStartUtc = new Date(`${since}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = formatIsoDate(tomorrowDate);
  const tomorrowStartUtc = new Date(`${tomorrow}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();

  const [{ data: tasksData }, { data: profilesData }] = await Promise.all([
    sb.from("tasks")
      .select("atribuido_a, created_at, completed_at, due_date")
      .in("status", ["concluida", "postada"])
      .gte("completed_at", sinceStartUtc)
      .lt("completed_at", tomorrowStartUtc)
      .not("atribuido_a", "is", null)
      .is("deleted_at", null),
    sb.from("profiles").select("id, nome").eq("ativo", true),
  ]);

  const rows = ((tasksData ?? []) as Array<Record<string, unknown>>)
    .filter((r) => r.completed_at)
    .map((r) => ({
      atribuido_a: r.atribuido_a as string,
      created_at: r.created_at as string,
      completed_at: r.completed_at as string,
      due_date: (r.due_date as string | null) ?? null,
    })) as TaskPrazoRow[];

  const nomes = new Map<string, string>();
  for (const p of (profilesData ?? []) as Array<{ id: string; nome: string }>) nomes.set(p.id, p.nome);

  const pessoas: PrazoAgilidadeRow[] = computePrazoAgilidade(rows)
    .map((p) => ({ ...p, nome: nomes.get(p.user_id) ?? "—" }))
    .sort((a, b) => {
      // Quem tem prazo primeiro (por % desc); depois por volume de entregas.
      const pa = a.com_prazo > 0 ? a.no_prazo / a.com_prazo : -1;
      const pb = b.com_prazo > 0 ? b.no_prazo / b.com_prazo : -1;
      return pb - pa || b.entregues - a.entregues || a.nome.localeCompare(b.nome);
    });

  return { pessoas, resumo: resumoPrazoAgilidade(pessoas) };
}

export interface QualidadeSetorResult {
  assessoria: RetrabalhoRow[]; // retrabalho (ajustes solicitados) por pessoa
  design: AprovacaoRow[];      // % de artes aprovadas por pessoa
}

/**
 * Qualidade por setor no período:
 * - Assessoria: nº de ajustes solicitados (task_revisoes tipo=ajustes), creditado ao
 *   DONO da tarefa (não a quem pediu o ajuste).
 * - Design: artes criadas vs aprovadas (aprovado/agendado/publicado).
 */
export async function getQualidadeSetor(range: PeriodoRange = "dia"): Promise<QualidadeSetorResult> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const today = formatIsoDate(new Date());
  const since = computeSince(range, today);
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const sinceStartUtc = new Date(`${since}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = formatIsoDate(tomorrowDate);
  const tomorrowStartUtc = new Date(`${tomorrow}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();

  const [{ data: revisoesData }, { data: artesData }, { data: profilesData }] = await Promise.all([
    sb.from("task_revisoes")
      .select("criado_em, task:tasks(atribuido_a)")
      .eq("tipo", "ajustes")
      .gte("criado_em", sinceStartUtc)
      .lt("criado_em", tomorrowStartUtc),
    sb.from("design_artes")
      .select("criado_por, status")
      .is("archived_at", null)
      .gte("created_at", sinceStartUtc)
      .lt("created_at", tomorrowStartUtc)
      .not("criado_por", "is", null),
    sb.from("profiles").select("id, nome").eq("ativo", true),
  ]);

  const nomes = new Map<string, string>();
  for (const p of (profilesData ?? []) as Array<{ id: string; nome: string }>) nomes.set(p.id, p.nome);

  const revisoesRows = ((revisoesData ?? []) as Array<Record<string, unknown>>).map((r) => ({
    atribuido_a: ((r.task as { atribuido_a?: string | null } | null) ?? null)?.atribuido_a ?? null,
  }));
  const artesRows = ((artesData ?? []) as Array<Record<string, unknown>>).map((r) => ({
    criado_por: (r.criado_por as string | null) ?? null,
    aprovada: DESIGN_STATUS_APROVADA.includes(r.status as string),
  }));

  const assessoria: RetrabalhoRow[] = computeRetrabalho(revisoesRows).map((p) => ({ ...p, nome: nomes.get(p.user_id) ?? "—" }));
  const design: AprovacaoRow[] = computeAprovacaoDesign(artesRows).map((p) => ({ ...p, nome: nomes.get(p.user_id) ?? "—" }));

  return { assessoria, design };
}

/**
 * Conversão comercial no período: ligações de saída → leads gerados, por assessor.
 * "lead" = ligação com lead_gerado_id preenchido.
 */
export async function getConversaoComercial(range: PeriodoRange = "dia"): Promise<ConversaoRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const today = formatIsoDate(new Date());
  const since = computeSince(range, today);
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const sinceStartUtc = new Date(`${since}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = formatIsoDate(tomorrowDate);
  const tomorrowStartUtc = new Date(`${tomorrow}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();

  const [{ data: ligacoesData }, { data: profilesData }] = await Promise.all([
    sb.from("ligacoes")
      .select("colaborador_id, lead_gerado_id")
      .eq("direcao", "saida")
      .gte("iniciada_em", sinceStartUtc)
      .lt("iniciada_em", tomorrowStartUtc)
      .not("colaborador_id", "is", null),
    sb.from("profiles").select("id, nome").eq("ativo", true),
  ]);

  const nomes = new Map<string, string>();
  for (const p of (profilesData ?? []) as Array<{ id: string; nome: string }>) nomes.set(p.id, p.nome);

  const rows = ((ligacoesData ?? []) as Array<Record<string, unknown>>).map((r) => ({
    colaborador_id: (r.colaborador_id as string | null) ?? null,
    temLead: r.lead_gerado_id != null,
  }));

  return computeConversao(rows).map((p) => ({ ...p, nome: nomes.get(p.user_id) ?? "—" }));
}

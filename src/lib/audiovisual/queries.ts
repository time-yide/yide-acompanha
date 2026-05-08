// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const DEADLINE_HOUR_BRT = 9;

export const AUDIOVISUAL_PENDENTE_TAG = "audiovisual-pendente";

export interface CapturaRow {
  id: string;
  event_id: string | null;
  client_id: string;
  videomaker_id: string;
  data_captacao: string;
  drive_url: string;
  qtd_videos: number;
  qtd_fotos: number;
  observacoes: string | null;
  rating_organizacao: number | null;
  rating_facilidade: number | null;
  rating_execucao_roteiro: number | null;
  rating_atrasos: number | null;
  rating_comunicacao: number | null;
  rating_retrabalho: number | null;
  rating_colaboracao: number | null;
  pontos_positivos: string | null;
  pontos_dificuldade: string | null;
  sugestoes: string | null;
  created_at: string;
  task_id: string | null;
  concluida_em: string | null;
  cliente?: { id: string; nome: string } | null;
  videomaker?: { id: string; nome: string } | null;
  /** Quando task_id existe, embarca dados básicos da tarefa pra UI mostrar
   *  "Delegado a [editor]" sem N+1 query. NULL se task_id também é NULL. */
  task?: { id: string; titulo: string; status: string; atribuido_a: string; editor_nome: string | null } | null;
}

export interface PendenteEvento {
  event_id: string;
  titulo: string;
  inicio: string;
  client_id: string | null;
  client_nome: string | null;
  videomaker_id: string;
  isOverdue: boolean; // passou das 09h do dia D+1
}

/** Calcula prazo limite (dia seguinte ao evento, 09h BRT). */
function getDeadline(eventInicioIso: string): Date {
  const inicio = new Date(eventInicioIso);
  // Próximo dia em BRT às 09h. Aproximação: pega a data UTC, soma 1 dia, fixa hora 12 UTC (= 09h BRT no horário padrão).
  const deadline = new Date(inicio);
  deadline.setUTCDate(deadline.getUTCDate() + 1);
  deadline.setUTCHours(DEADLINE_HOUR_BRT + 3, 0, 0, 0); // BRT = UTC-3
  return deadline;
}

/**
 * Lista eventos de gravação passados onde `userId` é videomaker e ainda não há
 * captura entregue. Marca quais já passaram do prazo (D+1 09h BRT).
 *
 * Inclui eventos sem client_id também (mas no form o videomaker terá que escolher).
 */
/**
 * Cacheado pra evitar 2 queries por navegação no layout authed.
 * Filtro explícito por userId (participantes_ids contains) preserva
 * segurança mesmo usando service-role dentro do cache. TTL 30s é
 * razoável (lock visual; pequena defasagem ok). Mutações em
 * audiovisual_capturas devem revalidar AUDIOVISUAL_PENDENTE_TAG.
 */
export async function listPendenteParaVideomaker(userId: string): Promise<PendenteEvento[]> {
  const cached = unstable_cache(
    async (uid: string) => _listPendenteParaVideomakerImpl(uid),
    ["audiovisual-pendente-videomaker"],
    { revalidate: 30, tags: [AUDIOVISUAL_PENDENTE_TAG] },
  );
  return cached(userId);
}

async function _listPendenteParaVideomakerImpl(userId: string): Promise<PendenteEvento[]> {
  const supabase = createServiceRoleClient();
  const now = new Date();

  // Eventos passados onde é participante (sub_calendar='videomakers')
  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, client_id, cliente:clients(id, nome)")
    .eq("sub_calendar", "videomakers")
    .contains("participantes_ids", [userId])
    .lt("inicio", now.toISOString())
    .order("inicio", { ascending: false })
    .limit(60);
  if (error || !events) return [];
  if (events.length === 0) return [];

  const eventIds = (events as Array<{ id: string }>).map((e) => e.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: capturas } = await sb
    .from("audiovisual_capturas")
    .select("event_id")
    .in("event_id", eventIds);
  const captured = new Set(((capturas ?? []) as Array<{ event_id: string | null }>).map((c) => c.event_id));

  return (events as Array<{
    id: string;
    titulo: string;
    inicio: string;
    client_id: string | null;
    cliente: { id: string; nome: string } | null;
  }>)
    .filter((e) => !captured.has(e.id))
    .map((e) => ({
      event_id: e.id,
      titulo: e.titulo,
      inicio: e.inicio,
      client_id: e.client_id,
      client_nome: e.cliente?.nome ?? null,
      videomaker_id: userId,
      isOverdue: now > getDeadline(e.inicio),
    }));
}

/** Quantas pendências expiradas o videomaker tem agora (gera bloqueio se > 0). */
export async function countOverdueParaVideomaker(userId: string): Promise<number> {
  const pendentes = await listPendenteParaVideomaker(userId);
  return pendentes.filter((p) => p.isOverdue).length;
}

/**
 * Lista capturas entregues. Filtros opcionais.
 */
export async function listCapturas(filters: {
  videomakerId?: string;
  clientId?: string;
  limit?: number;
} = {}): Promise<CapturaRow[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let query = sb
    .from("audiovisual_capturas")
    .select(`
      id, event_id, client_id, videomaker_id, data_captacao, drive_url,
      qtd_videos, qtd_fotos, observacoes,
      rating_organizacao, rating_facilidade, rating_execucao_roteiro,
      rating_atrasos, rating_comunicacao, rating_retrabalho, rating_colaboracao,
      pontos_positivos, pontos_dificuldade, sugestoes, created_at, task_id, concluida_em,
      cliente:clients(id, nome),
      videomaker:profiles!audiovisual_capturas_videomaker_id_fkey(id, nome),
      task:tasks!task_id(id, titulo, status, atribuido_a, editor:profiles!atribuido_a(nome))
    `)
    .order("data_captacao", { ascending: false })
    .limit(filters.limit ?? 100);
  if (filters.videomakerId) query = query.eq("videomaker_id", filters.videomakerId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);

  const { data, error } = await query;
  if (error) throw error;

  // Flatten task.editor.nome → task.editor_nome pro consumo na UI
  type RawTaskShape = {
    id: string;
    titulo: string;
    status: string;
    atribuido_a: string;
    editor: { nome: string } | null;
  };
  type RawRow = Omit<CapturaRow, "task"> & { task: RawTaskShape | null };
  return ((data ?? []) as unknown as RawRow[]).map((c) => ({
    ...c,
    task: c.task
      ? {
          id: c.task.id,
          titulo: c.task.titulo,
          status: c.task.status,
          atribuido_a: c.task.atribuido_a,
          editor_nome: c.task.editor?.nome ?? null,
        }
      : null,
  }));
}

/** Calcula a média (1-5) dos 7 ratings de uma captura. Null se algum faltar. */
export function avgRating(c: Pick<
  CapturaRow,
  | "rating_organizacao"
  | "rating_facilidade"
  | "rating_execucao_roteiro"
  | "rating_atrasos"
  | "rating_comunicacao"
  | "rating_retrabalho"
  | "rating_colaboracao"
>): number | null {
  const values = [
    c.rating_organizacao,
    c.rating_facilidade,
    c.rating_execucao_roteiro,
    c.rating_atrasos,
    c.rating_comunicacao,
    c.rating_retrabalho,
    c.rating_colaboracao,
  ];
  if (values.some((v) => v === null || v === undefined)) return null;
  const sum = values.reduce((s: number, v) => s + (v ?? 0), 0);
  return sum / values.length;
}

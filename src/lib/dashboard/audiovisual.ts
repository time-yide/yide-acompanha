// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePeriodo, type Periodo } from "./personal";

export interface GravacaoItem {
  id: string;
  titulo: string;
  inicio: string;
}

export interface TaskItem {
  id: string;
  titulo: string;
  status: string;
  due_date: string | null;
  prioridade: string | null;
}

export interface VideomakerStat {
  id: string;
  nome: string;
  proximasGravacoes: number;
  concluidasNoPeriodo: number;
  proximasGravacoesList: GravacaoItem[];
}

export interface EditorStat {
  id: string;
  nome: string;
  /** "editor" | "videomaker" | "audiovisual_chefe" — pra UI mostrar a função real. */
  role: string;
  pendentes: number;
  concluidasNoPeriodo: number;
  pendentesList: TaskItem[];
}

export interface EquipeAudiovisual {
  videomakers: VideomakerStat[];
  editores: EditorStat[];
  agregados: {
    totalGravacoesProximas: number;
    totalConcluidasNoPeriodo: number;
    totalPendentes: number;
  };
}

function getProximas2SemanasBR(): { fromIso: string; toIso: string } {
  const now = new Date();
  const brtOffsetMs = 3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() - brtOffsetMs);
  const day = brtNow.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(brtNow);
  monday.setUTCDate(brtNow.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sundayNextWeek = new Date(monday);
  sundayNextWeek.setUTCDate(monday.getUTCDate() + 13);
  sundayNextWeek.setUTCHours(23, 59, 59, 999);
  return {
    fromIso: new Date(monday.getTime() + brtOffsetMs).toISOString(),
    toIso: new Date(sundayNextWeek.getTime() + brtOffsetMs).toISOString(),
  };
}

interface TaskMinimal {
  id: string;
  titulo: string;
  atribuido_a: string | null;
  participantes_ids: string[] | null;
  status: string;
  completed_at: string | null;
  due_date: string | null;
  prioridade: string | null;
}

async function _getEquipeAudiovisualImpl(periodo: Periodo): Promise<EquipeAudiovisual> {
  const supabase = createServiceRoleClient();
  const { fromIso: periodoFrom, toIso: periodoTo } = resolvePeriodo(periodo);
  const { fromIso: gravFrom, toIso: gravTo } = getProximas2SemanasBR();

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .in("role", ["videomaker", "editor", "audiovisual_chefe"])
    .eq("ativo", true)
    .order("nome");
  const profiles = (profilesData ?? []) as Array<{ id: string; nome: string; role: string }>;
  if (profiles.length === 0) {
    return {
      videomakers: [],
      editores: [],
      agregados: { totalGravacoesProximas: 0, totalConcluidasNoPeriodo: 0, totalPendentes: 0 },
    };
  }
  const ids = profiles.map((p) => p.id);

  // Duas queries de tasks (atribuido vs participantes) + uma de eventos.
  // .or() com .in.() é tricky em PostgREST — duas queries simples é mais robusto.
  const [tasksAtribuidoRes, tasksParticipantesRes, gravRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, titulo, atribuido_a, participantes_ids, status, completed_at, due_date, prioridade")
      .in("atribuido_a", ids),
    supabase
      .from("tasks")
      .select("id, titulo, atribuido_a, participantes_ids, status, completed_at, due_date, prioridade")
      .overlaps("participantes_ids", ids),
    supabase
      .from("calendar_events")
      .select("id, titulo, participantes_ids, inicio")
      .eq("sub_calendar", "videomakers")
      .gte("inicio", gravFrom)
      .lte("inicio", gravTo)
      .order("inicio", { ascending: true }),
  ]);

  const tasksAtribuido = (tasksAtribuidoRes.data ?? []) as unknown as TaskMinimal[];
  const tasksParticipantes = (tasksParticipantesRes.data ?? []) as unknown as TaskMinimal[];
  // Dedupe por id
  const tasksMap = new Map<string, TaskMinimal>();
  for (const t of [...tasksAtribuido, ...tasksParticipantes]) tasksMap.set(t.id, t);
  const tasks = [...tasksMap.values()];

  const eventos = (gravRes.data ?? []) as Array<{
    id: string;
    titulo: string;
    participantes_ids: string[] | null;
    inicio: string;
  }>;

  const inPeriod = (iso: string | null) =>
    !!iso && iso >= periodoFrom && iso < periodoTo;

  const videomakers: VideomakerStat[] = profiles
    .filter((p) => p.role === "videomaker")
    .map((p) => {
      const proximasGravacoesList = eventos
        .filter((e) => (e.participantes_ids ?? []).includes(p.id))
        .map((e) => ({ id: e.id, titulo: e.titulo, inicio: e.inicio }));
      const concluidasNoPeriodo = tasks.filter(
        (t) => t.atribuido_a === p.id && t.status === "concluida" && inPeriod(t.completed_at),
      ).length;
      return {
        id: p.id,
        nome: p.nome,
        proximasGravacoes: proximasGravacoesList.length,
        concluidasNoPeriodo,
        proximasGravacoesList,
      };
    });

  // Seção "Edição" — todos editores aparecem sempre; videomakers e
  // audiovisual_chefe aparecem se tiverem tarefas (pendentes ou concluídas).
  const editores: EditorStat[] = profiles
    .map((p) => {
      const pendentesList: TaskItem[] = tasks
        .filter(
          (t) =>
            ["aberta", "em_andamento", "alteracao"].includes(t.status) &&
            (t.atribuido_a === p.id || (t.participantes_ids ?? []).includes(p.id)),
        )
        .map((t) => ({
          id: t.id,
          titulo: t.titulo,
          status: t.status,
          due_date: t.due_date,
          prioridade: t.prioridade,
        }))
        .sort((a, b) => {
          // Prazo asc (sem prazo no fim)
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return 0;
        });
      const concluidasNoPeriodo = tasks.filter(
        (t) => t.atribuido_a === p.id && t.status === "concluida" && inPeriod(t.completed_at),
      ).length;
      return {
        id: p.id,
        nome: p.nome,
        role: p.role,
        pendentes: pendentesList.length,
        concluidasNoPeriodo,
        pendentesList,
      };
    })
    .filter((row) => {
      if (row.role === "editor") return true;
      // videomaker / audiovisual_chefe: só aparece se tiver tarefa
      return row.pendentes > 0 || row.concluidasNoPeriodo > 0;
    });

  return {
    videomakers,
    editores,
    agregados: {
      totalGravacoesProximas: videomakers.reduce((s, v) => s + v.proximasGravacoes, 0),
      totalConcluidasNoPeriodo:
        videomakers.reduce((s, v) => s + v.concluidasNoPeriodo, 0) +
        editores.reduce((s, e) => s + e.concluidasNoPeriodo, 0),
      totalPendentes: editores.reduce((s, e) => s + e.pendentes, 0),
    },
  };
}

export async function getEquipeAudiovisual(periodo: Periodo): Promise<EquipeAudiovisual> {
  const cached = unstable_cache(
    async (p: string) => _getEquipeAudiovisualImpl(p as Periodo),
    // v2: agora retorna listas detalhadas (gravações + tarefas pendentes por user)
    ["dashboard-audiovisual-equipe-v2"],
    { revalidate: 60, tags: ["dashboard", "tasks", "calendar"] },
  );
  return cached(periodo);
}

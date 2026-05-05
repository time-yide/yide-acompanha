// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePeriodo, type Periodo } from "./personal";

export interface VideomakerStat {
  id: string;
  nome: string;
  proximasGravacoes: number;
  concluidasNoPeriodo: number;
}

export interface EditorStat {
  id: string;
  nome: string;
  pendentes: number;
  concluidasNoPeriodo: number;
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
  atribuido_a: string | null;
  participantes_ids: string[] | null;
  status: string;
  completed_at: string | null;
}

async function _getEquipeAudiovisualImpl(periodo: Periodo): Promise<EquipeAudiovisual> {
  const supabase = createServiceRoleClient();
  const { fromIso: periodoFrom, toIso: periodoTo } = resolvePeriodo(periodo);
  const { fromIso: gravFrom, toIso: gravTo } = getProximas2SemanasBR();

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .in("role", ["videomaker", "editor"])
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
      .select("id, atribuido_a, participantes_ids, status, completed_at")
      .in("atribuido_a", ids),
    supabase
      .from("tasks")
      .select("id, atribuido_a, participantes_ids, status, completed_at")
      .overlaps("participantes_ids", ids),
    supabase
      .from("calendar_events")
      .select("id, participantes_ids, inicio")
      .eq("sub_calendar", "videomakers")
      .gte("inicio", gravFrom)
      .lte("inicio", gravTo),
  ]);

  const tasksAtribuido = (tasksAtribuidoRes.data ?? []) as unknown as TaskMinimal[];
  const tasksParticipantes = (tasksParticipantesRes.data ?? []) as unknown as TaskMinimal[];
  // Dedupe por id
  const tasksMap = new Map<string, TaskMinimal>();
  for (const t of [...tasksAtribuido, ...tasksParticipantes]) tasksMap.set(t.id, t);
  const tasks = [...tasksMap.values()];

  const eventos = (gravRes.data ?? []) as Array<{
    id: string;
    participantes_ids: string[] | null;
    inicio: string;
  }>;

  const inPeriod = (iso: string | null) =>
    !!iso && iso >= periodoFrom && iso < periodoTo;

  const videomakers: VideomakerStat[] = profiles
    .filter((p) => p.role === "videomaker")
    .map((p) => {
      const proximasGravacoes = eventos.filter((e) =>
        (e.participantes_ids ?? []).includes(p.id),
      ).length;
      const concluidasNoPeriodo = tasks.filter(
        (t) => t.atribuido_a === p.id && t.status === "concluida" && inPeriod(t.completed_at),
      ).length;
      return { id: p.id, nome: p.nome, proximasGravacoes, concluidasNoPeriodo };
    });

  const editores: EditorStat[] = profiles
    .filter((p) => p.role === "editor")
    .map((p) => {
      const pendentes = tasks.filter(
        (t) =>
          t.status !== "concluida" &&
          (t.atribuido_a === p.id || (t.participantes_ids ?? []).includes(p.id)),
      ).length;
      const concluidasNoPeriodo = tasks.filter(
        (t) => t.atribuido_a === p.id && t.status === "concluida" && inPeriod(t.completed_at),
      ).length;
      return { id: p.id, nome: p.nome, pendentes, concluidasNoPeriodo };
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
    ["dashboard-audiovisual-equipe"],
    { revalidate: 60, tags: ["dashboard", "tasks", "calendar"] },
  );
  return cached(periodo);
}

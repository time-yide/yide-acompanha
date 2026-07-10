// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePeriodo, type Periodo } from "./personal";
import { getHojeAndFuturoBRT, getTerminadoEm } from "./audiovisual-helpers";
import { AUDIOVISUAL_CAPTURAS_TAG } from "@/lib/audiovisual/queries";

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
  cliente_nome: string | null;
}

export interface CapturaItem {
  id: string;
  data_captacao: string;
  cliente_nome: string | null;
  task_id: string | null;
  task_titulo: string | null;
}

export interface VideomakerStat {
  id: string;
  nome: string;
  proximas: number;
  hoje: number;
  concluidas: number;
  proximasList: GravacaoItem[];
  hojeList: GravacaoItem[];
  concluidasList: CapturaItem[];
}

export interface EditorStat {
  id: string;
  nome: string;
  /** "editor" | "videomaker" | "audiovisual_chefe" - pra UI mostrar a função real. */
  role: string;
  avatar_url: string | null;
  /** Abertas com prazo já vencido (`due_date < hoje BRT`). */
  atrasadas: number;
  /** Abertas com prazo hoje ou no futuro, ou sem prazo. */
  proximas: number;
  emAndamento: number;
  concluidas: number;
  atrasadasList: TaskItem[];
  proximasList: TaskItem[];
  emAndamentoList: TaskItem[];
  concluidasList: TaskItem[];
}

export interface EquipeAudiovisual {
  videomakers: VideomakerStat[];
  editores: EditorStat[];
  agregados: {
    totalGravacoesProximas: number;
    totalAtrasadasEdicao: number;
    totalEmAndamentoEdicao: number;
    totalConcluidasNoPeriodo: number;
  };
}

interface TaskMinimal {
  id: string;
  titulo: string;
  atribuido_a: string | null;
  participantes_ids: string[] | null;
  status: string;
  completed_at: string | null;
  aprovada_em: string | null;
  updated_at: string | null;
  due_date: string | null;
  prioridade: string | null;
  client_id: string | null;
  cliente: { nome: string } | null;
}

interface CapturaDelegadaMinimal {
  id: string;
  videomaker_id: string;
  data_captacao: string;
  created_at: string;
  task_id: string | null;
  client_id: string | null;
  cliente: { nome: string } | null;
  task: { titulo: string } | null;
}

const STATUS_EM_ANDAMENTO = ["em_andamento", "alteracao"] as const;
const STATUS_CONCLUIDA = ["concluida", "em_aprovacao", "aprovada", "agendado", "postada"] as const;

async function _getEquipeAudiovisualImpl(periodo: Periodo): Promise<EquipeAudiovisual> {
  const supabase = createServiceRoleClient();
  const { fromIso: periodoFrom, toIso: periodoTo } = resolvePeriodo(periodo);
  const { hojeFromIso, hojeToIso, futuroFromIso, futuroToIso } = getHojeAndFuturoBRT(2);
  // "Hoje BRT" como YYYY-MM-DD pra comparar com due_date (que é DATE, não timestamp).
  // hojeFromIso = BRT 00:00 em UTC; .slice(0,10) dá YYYY-MM-DD correto pro dia BRT.
  const hojeBRTDate = hojeFromIso.slice(0, 10);

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, nome, role, avatar_url")
    .in("role", ["videomaker", "fast_midia", "editor", "audiovisual_chefe"])
    .eq("ativo", true)
    .order("nome");
  const profiles = (profilesData ?? []) as Array<{ id: string; nome: string; role: string; avatar_url: string | null }>;
  if (profiles.length === 0) {
    return {
      videomakers: [],
      editores: [],
      agregados: { totalGravacoesProximas: 0, totalAtrasadasEdicao: 0, totalEmAndamentoEdicao: 0, totalConcluidasNoPeriodo: 0 },
    };
  }
  const ids = profiles.map((p) => p.id);
  const videomakerIds = profiles.filter((p) => p.role === "videomaker" || p.role === "fast_midia").map((p) => p.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [tasksAtribuidoRes, tasksParticipantesRes, gravRes, capturasRes] = await Promise.all([
    sb
      .from("tasks")
      .select("id, titulo, atribuido_a, participantes_ids, status, completed_at, aprovada_em, updated_at, due_date, prioridade, client_id, cliente:clients(nome)")
      .is("deleted_at", null)
      .in("atribuido_a", ids),
    sb
      .from("tasks")
      .select("id, titulo, atribuido_a, participantes_ids, status, completed_at, aprovada_em, updated_at, due_date, prioridade, client_id, cliente:clients(nome)")
      .is("deleted_at", null)
      .overlaps("participantes_ids", ids),
    sb
      .from("calendar_events")
      .select("id, titulo, participantes_ids, inicio")
      .eq("sub_calendar", "videomakers")
      .gte("inicio", hojeFromIso)
      .lt("inicio", futuroToIso)
      .order("inicio", { ascending: true }),
    videomakerIds.length > 0
      ? sb
          .from("audiovisual_capturas")
          .select("id, videomaker_id, data_captacao, created_at, task_id, client_id, cliente:clients(nome), task:tasks!task_id(titulo)")
          .in("videomaker_id", videomakerIds)
          .not("task_id", "is", null)
          .gte("created_at", periodoFrom)
          .lt("created_at", periodoTo)
      : Promise.resolve({ data: [] }),
  ]);

  const tasksAtribuido = (tasksAtribuidoRes.data ?? []) as unknown as TaskMinimal[];
  const tasksParticipantes = (tasksParticipantesRes.data ?? []) as unknown as TaskMinimal[];
  const tasksMap = new Map<string, TaskMinimal>();
  for (const t of [...tasksAtribuido, ...tasksParticipantes]) tasksMap.set(t.id, t);
  const tasks = [...tasksMap.values()];

  const eventos = (gravRes.data ?? []) as Array<{
    id: string;
    titulo: string;
    participantes_ids: string[] | null;
    inicio: string;
  }>;

  const capturas = (capturasRes.data ?? []) as unknown as CapturaDelegadaMinimal[];

  const inPeriod = (iso: string | null) => !!iso && iso >= periodoFrom && iso < periodoTo;

  const videomakers: VideomakerStat[] = profiles
    .filter((p) => p.role === "videomaker" || p.role === "fast_midia")
    .map((p) => {
      const proximasList = eventos
        .filter((e) => (e.participantes_ids ?? []).includes(p.id) && e.inicio >= futuroFromIso && e.inicio < futuroToIso)
        .map((e) => ({ id: e.id, titulo: e.titulo, inicio: e.inicio }));
      const hojeList = eventos
        .filter((e) => (e.participantes_ids ?? []).includes(p.id) && e.inicio >= hojeFromIso && e.inicio < hojeToIso)
        .map((e) => ({ id: e.id, titulo: e.titulo, inicio: e.inicio }));
      const concluidasList: CapturaItem[] = capturas
        .filter((c) => c.videomaker_id === p.id)
        .map((c) => ({
          id: c.id,
          data_captacao: c.data_captacao,
          cliente_nome: c.cliente?.nome ?? null,
          task_id: c.task_id,
          task_titulo: c.task?.titulo ?? null,
        }));

      // Sort chronologically
      proximasList.sort((a, b) => a.inicio.localeCompare(b.inicio));
      hojeList.sort((a, b) => a.inicio.localeCompare(b.inicio));
      // Sort by data_captacao desc (most recent first)
      concluidasList.sort((a, b) => b.data_captacao.localeCompare(a.data_captacao));

      return {
        id: p.id,
        nome: p.nome,
        proximas: proximasList.length,
        hoje: hojeList.length,
        concluidas: concluidasList.length,
        proximasList,
        hojeList,
        concluidasList,
      };
    });

  const pertence = (t: TaskMinimal, pid: string) =>
    t.atribuido_a === pid || (t.participantes_ids ?? []).includes(pid);

  const editores: EditorStat[] = profiles
    .map((p) => {
      // Abertas: separa em "atrasadas" (due_date < hoje) e "próximas" (due_date
      // >= hoje OU sem prazo). Antes "Próximas" filtrava só por status, então
      // tarefas vencidas ficavam infiltradas - coordenador via prazo de ontem
      // listado como "próximo".
      const abertasDoMembro = tasks.filter(
        (t) => t.status === "aberta" && pertence(t, p.id),
      );
      const atrasadasList: TaskItem[] = abertasDoMembro
        .filter((t) => !!t.due_date && t.due_date < hojeBRTDate)
        .map((t) => ({ id: t.id, titulo: t.titulo, status: t.status, due_date: t.due_date, prioridade: t.prioridade, cliente_nome: t.cliente?.nome ?? null }));
      const proximasList: TaskItem[] = abertasDoMembro
        .filter((t) => !t.due_date || t.due_date >= hojeBRTDate)
        .map((t) => ({ id: t.id, titulo: t.titulo, status: t.status, due_date: t.due_date, prioridade: t.prioridade, cliente_nome: t.cliente?.nome ?? null }));

      const emAndamentoList: TaskItem[] = tasks
        .filter((t) => (STATUS_EM_ANDAMENTO as readonly string[]).includes(t.status) && pertence(t, p.id))
        .map((t) => ({ id: t.id, titulo: t.titulo, status: t.status, due_date: t.due_date, prioridade: t.prioridade, cliente_nome: t.cliente?.nome ?? null }));

      const concluidasWithTime = tasks
        .filter(
          (t) =>
            (STATUS_CONCLUIDA as readonly string[]).includes(t.status) &&
            pertence(t, p.id) &&
            inPeriod(getTerminadoEm(t)),
        )
        .map((t) => ({
          item: { id: t.id, titulo: t.titulo, status: t.status, due_date: t.due_date, prioridade: t.prioridade, cliente_nome: t.cliente?.nome ?? null },
          terminadoEm: getTerminadoEm(t),
        }));

      // Sort by terminadoEm desc (most recent first)
      concluidasWithTime.sort((a, b) => {
        if (a.terminadoEm && b.terminadoEm) return b.terminadoEm.localeCompare(a.terminadoEm);
        if (a.terminadoEm) return -1;
        if (b.terminadoEm) return 1;
        return 0;
      });

      const concluidasList: TaskItem[] = concluidasWithTime.map((x) => x.item);

      const sortByDue = (a: TaskItem, b: TaskItem) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      };
      // Atrasadas: do prazo mais antigo (mais atrasado) pro mais recente.
      atrasadasList.sort(sortByDue);
      // Próximas e em andamento: do prazo mais próximo pro mais distante.
      proximasList.sort(sortByDue);
      emAndamentoList.sort(sortByDue);

      return {
        id: p.id,
        nome: p.nome,
        role: p.role,
        avatar_url: p.avatar_url,
        atrasadas: atrasadasList.length,
        proximas: proximasList.length,
        emAndamento: emAndamentoList.length,
        concluidas: concluidasList.length,
        atrasadasList,
        proximasList,
        emAndamentoList,
        concluidasList,
      };
    })
    .filter((row) => {
      if (row.role === "editor") return true;
      return row.atrasadas + row.proximas + row.emAndamento + row.concluidas > 0;
    });

  const totalGravacoesProximas = videomakers.reduce((s, v) => s + v.proximas + v.hoje, 0);
  const totalAtrasadasEdicao = editores.reduce((s, e) => s + e.atrasadas, 0);
  const totalEmAndamentoEdicao = editores.reduce((s, e) => s + e.emAndamento, 0);
  const totalConcluidasNoPeriodo =
    videomakers.reduce((s, v) => s + v.concluidas, 0) +
    editores.reduce((s, e) => s + e.concluidas, 0);

  return {
    videomakers,
    editores,
    agregados: { totalGravacoesProximas, totalAtrasadasEdicao, totalEmAndamentoEdicao, totalConcluidasNoPeriodo },
  };
}

export async function getEquipeAudiovisual(periodo: Periodo): Promise<EquipeAudiovisual> {
  const cached = unstable_cache(
    async (p: string) => _getEquipeAudiovisualImpl(p as Periodo),
    // v3: shape mudou (videomaker proximas/hoje/concluidas, editor proximas/emAndamento/concluidas)
    // v4: EditorStat ganhou atrasadas + atrasadasList (separa por due_date < hoje BRT)
    // v5: TaskItem ganhou cliente_nome (join clients p/ mostrar cliente inline na edição)
    ["dashboard-audiovisual-equipe-v6"],
    { revalidate: 60, tags: ["dashboard", "tasks", "calendar", AUDIOVISUAL_CAPTURAS_TAG] },
  );
  return cached(periodo);
}

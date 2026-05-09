import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface CursoRow {
  id: string;
  titulo: string;
  descricao: string;
  criado_por: string;
  criado_em: string;
  criador?: { id: string; nome: string } | null;
  total_responsaveis: number;
  total_aprovados: number;
}

export interface CursoComStatus extends CursoRow {
  /** Status do user atual relativo a este curso. */
  meu_status: "nao_atribuido" | "pendente" | "aprovado";
  /** Número da última tentativa do user (null se nunca tentou). */
  meu_acertos: number | null;
}

export interface QuestaoRow {
  id: string;
  curso_id: string;
  ordem: number;
  enunciado: string;
  alternativas: string[];
  /** Só preenche pra criador/admin — server filtra antes de mandar pro client. */
  correta?: number;
}

export interface TentativaRow {
  id: string;
  curso_id: string;
  participante_id: string;
  acertos: number;
  aprovado: boolean;
  criado_em: string;
  participante?: { id: string; nome: string; avatar_url: string | null } | null;
}

export interface RankingRow {
  participante_id: string;
  nome: string;
  avatar_url: string | null;
  pontos: number;
  cursos_aprovados: number;
}

/** Lista cursos atribuídos ao user atual (responsável). */
export async function listMeusCursos(userId: string): Promise<CursoComStatus[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: assigned } = await sb
    .from("academy_responsaveis")
    .select("curso_id")
    .eq("participante_id", userId);
  const cursoIds = ((assigned ?? []) as { curso_id: string }[]).map((r) => r.curso_id);
  if (cursoIds.length === 0) return [];

  return await loadCursosWithStats(cursoIds, userId);
}

/** Lista todos os cursos (pra criadores/admins). */
export async function listAllCursos(userId: string): Promise<CursoComStatus[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("academy_cursos")
    .select("id")
    .is("deleted_at", null);
  const cursoIds = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (cursoIds.length === 0) return [];
  return await loadCursosWithStats(cursoIds, userId);
}

async function loadCursosWithStats(cursoIds: string[], userId: string): Promise<CursoComStatus[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [cursosRes, respRes, tentRes] = await Promise.all([
    sb
      .from("academy_cursos")
      .select(`
        id, titulo, descricao, criado_por, criado_em,
        criador:profiles!academy_cursos_criado_por_fkey(id, nome)
      `)
      .in("id", cursoIds)
      .is("deleted_at", null)
      .order("criado_em", { ascending: false }),
    sb.from("academy_responsaveis").select("curso_id, participante_id").in("curso_id", cursoIds),
    sb
      .from("academy_tentativas")
      .select("curso_id, participante_id, acertos, aprovado")
      .in("curso_id", cursoIds),
  ]);

  const cursos = (cursosRes.data ?? []) as Array<{
    id: string;
    titulo: string;
    descricao: string;
    criado_por: string;
    criado_em: string;
    criador?: { id: string; nome: string } | null;
  }>;
  const responsaveis = (respRes.data ?? []) as Array<{ curso_id: string; participante_id: string }>;
  const tentativas = (tentRes.data ?? []) as Array<{
    curso_id: string;
    participante_id: string;
    acertos: number;
    aprovado: boolean;
  }>;

  // Distinct aprovados por curso
  const aprovadosByCurso = new Map<string, Set<string>>();
  for (const t of tentativas) {
    if (!t.aprovado) continue;
    if (!aprovadosByCurso.has(t.curso_id)) aprovadosByCurso.set(t.curso_id, new Set());
    aprovadosByCurso.get(t.curso_id)!.add(t.participante_id);
  }

  // Total responsáveis por curso
  const respByCurso = new Map<string, number>();
  const meusAtribuidos = new Set<string>();
  for (const r of responsaveis) {
    respByCurso.set(r.curso_id, (respByCurso.get(r.curso_id) ?? 0) + 1);
    if (r.participante_id === userId) meusAtribuidos.add(r.curso_id);
  }

  // Última tentativa minha por curso (acertos)
  const minhaTentativaByCurso = new Map<string, number>();
  for (const t of tentativas) {
    if (t.participante_id !== userId) continue;
    const prev = minhaTentativaByCurso.get(t.curso_id);
    if (prev === undefined || t.acertos > prev) minhaTentativaByCurso.set(t.curso_id, t.acertos);
  }

  return cursos.map((c) => {
    const aprovados = aprovadosByCurso.get(c.id);
    const aprovadoUser = aprovados?.has(userId) ?? false;
    const atribuido = meusAtribuidos.has(c.id);
    const status: CursoComStatus["meu_status"] = aprovadoUser
      ? "aprovado"
      : atribuido
        ? "pendente"
        : "nao_atribuido";
    return {
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao,
      criado_por: c.criado_por,
      criado_em: c.criado_em,
      criador: c.criador ?? null,
      total_responsaveis: respByCurso.get(c.id) ?? 0,
      total_aprovados: aprovados?.size ?? 0,
      meu_status: status,
      meu_acertos: minhaTentativaByCurso.get(c.id) ?? null,
    };
  });
}

export async function getCursoById(cursoId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("academy_cursos")
    .select(`
      id, titulo, descricao, criado_por, criado_em,
      criador:profiles!academy_cursos_criado_por_fkey(id, nome)
    `)
    .eq("id", cursoId)
    .is("deleted_at", null)
    .single();
  if (error || !data) return null;
  return data as {
    id: string;
    titulo: string;
    descricao: string;
    criado_por: string;
    criado_em: string;
    criador?: { id: string; nome: string } | null;
  };
}

/**
 * Carrega questões. Quando includeCorreta=false, NUNCA expõe `correta` (gabarito).
 * Use false pra responsável fazer prova; true só pra criador/admin no preview.
 */
export async function listQuestoes(
  cursoId: string,
  includeCorreta: boolean,
): Promise<QuestaoRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const cols = includeCorreta
    ? "id, curso_id, ordem, enunciado, alternativas, correta"
    : "id, curso_id, ordem, enunciado, alternativas";
  const { data } = await sb
    .from("academy_questoes")
    .select(cols)
    .eq("curso_id", cursoId)
    .order("ordem", { ascending: true });
  return (data ?? []) as QuestaoRow[];
}

export async function listResponsaveisDoCurso(cursoId: string) {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("academy_responsaveis")
    .select(`
      participante_id,
      participante:profiles!academy_responsaveis_participante_id_fkey(id, nome, avatar_url)
    `)
    .eq("curso_id", cursoId);
  return (data ?? []) as Array<{
    participante_id: string;
    participante: { id: string; nome: string; avatar_url: string | null } | null;
  }>;
}

export async function listTentativasDoCurso(cursoId: string): Promise<TentativaRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("academy_tentativas")
    .select(`
      id, curso_id, participante_id, acertos, aprovado, criado_em,
      participante:profiles!academy_tentativas_participante_id_fkey(id, nome, avatar_url)
    `)
    .eq("curso_id", cursoId)
    .order("criado_em", { ascending: false });
  return (data ?? []) as TentativaRow[];
}

export async function listMinhasTentativas(
  cursoId: string,
  userId: string,
): Promise<TentativaRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("academy_tentativas")
    .select("id, curso_id, participante_id, acertos, aprovado, criado_em")
    .eq("curso_id", cursoId)
    .eq("participante_id", userId)
    .order("criado_em", { ascending: false });
  return (data ?? []) as TentativaRow[];
}

export async function getRanking(): Promise<RankingRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("academy_ranking")
    .select("*")
    .order("pontos", { ascending: false })
    .order("nome", { ascending: true });
  return (data ?? []) as RankingRow[];
}

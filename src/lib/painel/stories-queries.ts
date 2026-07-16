// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface StoriesRow {
  client_id: string;
  client_nome: string;
  quantidade_diaria_stories: number;
  assessor_nome: string | null;
  postados: number;
  meta: number;
}

/** Nº de dias do mês 'YYYY-MM'. */
export function diasNoMes(mesRef: string): number {
  const [y, m] = mesRef.split("-").map(Number);
  // m é 1-12; dia 0 do próximo mês = último dia do mês corrente.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Clientes com stories ativado + contagem do mês. meta = diária × dias do mês.
 *
 * Usa service-role (mesmo padrão de queries.ts): SELECT policies em clients /
 * client_monthly_stories são permissivas por role; a filtragem de segurança
 * fica no unitClientIds passado pelo caller (unidade ativa) + no gate de role
 * na página. `as any` porque tem_stories/quantidade_diaria_stories e a tabela
 * client_monthly_stories ainda não estão nos tipos gerados.
 */
export async function getStoriesForMonth(
  mesRef: string,
  unitClientIds: string[] | null,
): Promise<StoriesRow[]> {
  // Unidade nova sem clientes → nada a mostrar.
  if (unitClientIds !== null && unitClientIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  let clientsQuery = supabase
    .from("clients")
    .select("id, nome, quantidade_diaria_stories, assessor_id")
    .eq("status", "ativo")
    .eq("tem_stories", true);
  if (unitClientIds !== null) {
    clientsQuery = clientsQuery.in("id", unitClientIds);
  }

  const { data: clientsData, error: clientsError } = await clientsQuery.order("nome");
  if (clientsError) {
    console.error("[painel/stories] erro ao listar clientes:", clientsError.message);
    return [];
  }

  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    quantidade_diaria_stories: number | null;
    assessor_id: string | null;
  }>;
  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  // Nome do assessor responsável de cada cliente.
  const assessorIds = [...new Set(clients.map((c) => c.assessor_id).filter((id): id is string => !!id))];
  const assessorNomeById = new Map<string, string>();
  if (assessorIds.length > 0) {
    const { data: assessoresData } = await supabase
      .from("profiles")
      .select("id, nome")
      .in("id", assessorIds);
    for (const a of (assessoresData ?? []) as Array<{ id: string; nome: string }>) {
      assessorNomeById.set(a.id, a.nome);
    }
  }

  const { data: monthlyData, error: monthlyError } = await supabase
    .from("client_monthly_stories")
    .select("client_id, quantidade_postada")
    .eq("mes_referencia", mesRef)
    .in("client_id", clientIds);
  if (monthlyError) {
    console.error("[painel/stories] erro ao listar contagem mensal:", monthlyError.message);
  }

  const postadosByClient = new Map<string, number>();
  for (const row of (monthlyData ?? []) as Array<{ client_id: string; quantidade_postada: number | null }>) {
    postadosByClient.set(row.client_id, row.quantidade_postada ?? 0);
  }

  const dias = diasNoMes(mesRef);

  return clients
    .map((c) => {
      const diaria = c.quantidade_diaria_stories ?? 0;
      return {
        client_id: c.id,
        client_nome: c.nome,
        quantidade_diaria_stories: diaria,
        assessor_nome: c.assessor_id ? (assessorNomeById.get(c.assessor_id) ?? null) : null,
        postados: postadosByClient.get(c.id) ?? 0,
        meta: diaria * dias,
      };
    })
    .sort((a, b) => a.client_nome.localeCompare(b.client_nome, "pt-BR"));
}

export interface StoryDay {
  dia: number;
  /** "YYYY-MM-DD" */
  data: string;
  postado: boolean;
  quantidade: number;
}

export interface StoriesGridRow {
  client_id: string;
  client_nome: string;
  quantidade_diaria_stories: number;
  assessor_id: string | null;
  assessor_nome: string | null;
  stories_instrucao: string | null;
  dias: StoryDay[];
  postados: number;
  meta: number;
}

/**
 * Grade de stories POR DIA do mês (aba FastMedia). Pra cada cliente com stories
 * ativado, devolve um array de dias (1..N do mês) marcando quais já foram
 * postados (via client_story_posts) e a quantidade de cada dia. `postados` é a
 * soma das quantidades; `meta` = diária × dias do mês.
 */
export async function getStoriesGridForMonth(
  mesRef: string,
  unitClientIds: string[] | null,
): Promise<StoriesGridRow[]> {
  if (unitClientIds !== null && unitClientIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  // SELECT resiliente: tenta com stories_instrucao; se a coluna ainda não existe
  // (gap entre deploy e migration manual), refaz sem ela pra não esvaziar a grade.
  const buildClientsQuery = (cols: string) => {
    let q = supabase
      .from("clients")
      .select(cols)
      .eq("status", "ativo")
      .eq("tem_stories", true);
    if (unitClientIds !== null) q = q.in("id", unitClientIds);
    return q.order("nome");
  };

  const BASE_COLS = "id, nome, quantidade_diaria_stories, assessor_id";
  let { data: clientsData, error: clientsError } = await buildClientsQuery(
    `${BASE_COLS}, stories_instrucao`,
  );
  if (clientsError && /stories_instrucao|column|schema cache/i.test(clientsError.message ?? "")) {
    console.warn(
      "[painel/stories-grid] coluna stories_instrucao ainda não existe, usando fallback:",
      clientsError.message,
    );
    ({ data: clientsData, error: clientsError } = await buildClientsQuery(BASE_COLS));
  }
  if (clientsError) {
    console.error("[painel/stories-grid] erro ao listar clientes:", clientsError.message);
    return [];
  }
  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    quantidade_diaria_stories: number | null;
    assessor_id: string | null;
    stories_instrucao?: string | null;
  }>;
  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  // Nome do assessor de cada cliente.
  const assessorIds = [...new Set(clients.map((c) => c.assessor_id).filter((id): id is string => !!id))];
  const assessorNomeById = new Map<string, string>();
  if (assessorIds.length > 0) {
    const { data: assessoresData } = await supabase
      .from("profiles")
      .select("id, nome")
      .in("id", assessorIds);
    for (const a of (assessoresData ?? []) as Array<{ id: string; nome: string }>) {
      assessorNomeById.set(a.id, a.nome);
    }
  }

  const dias = diasNoMes(mesRef);
  const start = `${mesRef}-01`;
  const [y, m] = mesRef.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const { data: postsData, error: postsError } = await supabase
    .from("client_story_posts")
    .select("client_id, data, quantidade")
    .gte("data", start)
    .lt("data", end)
    .in("client_id", clientIds);
  if (postsError) {
    console.error("[painel/stories-grid] erro ao listar posts:", postsError.message);
  }

  // client_id -> Map(dia -> quantidade)
  const postsByClient = new Map<string, Map<number, number>>();
  for (const p of (postsData ?? []) as Array<{ client_id: string; data: string; quantidade: number | null }>) {
    const dia = Number(p.data.slice(8, 10));
    if (!postsByClient.has(p.client_id)) postsByClient.set(p.client_id, new Map());
    postsByClient.get(p.client_id)!.set(dia, p.quantidade ?? 0);
  }

  return clients
    .map((c) => {
      const diaria = c.quantidade_diaria_stories ?? 0;
      const daysMap = postsByClient.get(c.id) ?? new Map<number, number>();
      const diasArr: StoryDay[] = [];
      let postados = 0;
      for (let d = 1; d <= dias; d++) {
        const qtd = daysMap.get(d);
        const postado = qtd !== undefined;
        if (postado) postados += qtd ?? 0;
        diasArr.push({
          dia: d,
          data: `${mesRef}-${String(d).padStart(2, "0")}`,
          postado,
          quantidade: qtd ?? 0,
        });
      }
      return {
        client_id: c.id,
        client_nome: c.nome,
        quantidade_diaria_stories: diaria,
        assessor_id: c.assessor_id,
        assessor_nome: c.assessor_id ? (assessorNomeById.get(c.assessor_id) ?? null) : null,
        stories_instrucao: c.stories_instrucao ?? null,
        dias: diasArr,
        postados,
        meta: diaria * dias,
      };
    })
    .sort((a, b) => a.client_nome.localeCompare(b.client_nome, "pt-BR"));
}

export interface ClienteElegivelStories {
  id: string;
  nome: string;
}

/**
 * Clientes que PODEM entrar na grade de stories: status 'ativo' e ainda sem
 * stories ativado. Serve o seletor do dialog "Adicionar cliente" no /fast-media.
 * Filtra pela unidade ativa (unitClientIds); service-role, mesmo padrão das
 * demais queries deste arquivo.
 */
export async function getClientesElegiveisStories(
  unitClientIds: string[] | null,
): Promise<ClienteElegivelStories[]> {
  // Unidade nova sem clientes → nada elegível.
  if (unitClientIds !== null && unitClientIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  let q = supabase
    .from("clients")
    .select("id, nome")
    .eq("status", "ativo")
    .eq("tem_stories", false);
  if (unitClientIds !== null) q = q.in("id", unitClientIds);

  const { data, error } = await q.order("nome");
  if (error) {
    console.error("[painel/stories] erro ao listar elegíveis:", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ id: string; nome: string }>).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

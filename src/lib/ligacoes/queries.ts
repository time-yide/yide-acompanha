// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";
import type { StatusLigacao, TipoLigacao } from "./tipos";

// Quando alguém criar webhook de PABX/Evolution, chamar `revalidateTag("ligacoes")`
// no handler pra invalidar manualmente. Por enquanto, TTL 120s é aceitável
// (página vista poucas vezes por dia).
const LIGACOES_TAG = "ligacoes" as const;
const LIGACOES_REVALIDATE_SECONDS = 120;

export interface LigacaoRow {
  id: string;
  tipo: string;
  direcao: string;
  status: string;
  numero: string;
  contato_nome: string | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  iniciada_em: string;
  finalizada_em: string | null;
  duracao_segundos: number;
  observacoes: string | null;
  gravacao_url: string | null;
  transcricao: string | null;
  resumo_ia: string | null;
  origem: string;
  tags: string[];
  lead_id: string | null;
  lead_gerado_id: string | null;
  client_id: string | null;
  client_nome: string | null;
}

export interface ListLigacoesFilter {
  searchQuery?: string;          // busca por número / contato_nome
  status?: StatusLigacao | "todos";
  tipo?: TipoLigacao | "todos";
  colaboradorId?: string | null;
  /** Periodo ISO (YYYY-MM-DD) */
  desde?: string;
  ate?: string;
  duracaoMin?: number;           // em segundos
  duracaoMax?: number;
  /** 1-indexed */
  page?: number;
  pageSize?: number;
}

export interface ListLigacoesResult {
  ligacoes: LigacaoRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function _listLigacoesImpl(
  organizationId: string,
  filter: ListLigacoesFilter = {},
): Promise<ListLigacoesResult> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const pageSize = Math.max(1, Math.min(200, Math.floor(filter.pageSize ?? 50)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = sb
    .from("ligacoes")
    .select(
      `id, tipo, direcao, status, numero, contato_nome, colaborador_id, iniciada_em, finalizada_em,
       duracao_segundos, observacoes, gravacao_url, transcricao, resumo_ia, origem, tags,
       lead_id, lead_gerado_id, client_id,
       colaborador:profiles!ligacoes_colaborador_id_fkey(nome),
       client:clients!ligacoes_client_id_fkey(nome)`,
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("arquivado_em", null);

  if (filter.searchQuery && filter.searchQuery.trim()) {
    const search = filter.searchQuery.trim();
    q = q.or(`numero.ilike.%${search}%,contato_nome.ilike.%${search}%`);
  }
  if (filter.status && filter.status !== "todos") {
    q = q.eq("status", filter.status);
  }
  if (filter.tipo && filter.tipo !== "todos") {
    q = q.eq("tipo", filter.tipo);
  }
  if (filter.colaboradorId) {
    q = q.eq("colaborador_id", filter.colaboradorId);
  }
  if (filter.desde) {
    q = q.gte("iniciada_em", `${filter.desde}T00:00:00Z`);
  }
  if (filter.ate) {
    q = q.lte("iniciada_em", `${filter.ate}T23:59:59Z`);
  }
  if (filter.duracaoMin !== undefined && filter.duracaoMin > 0) {
    q = q.gte("duracao_segundos", filter.duracaoMin);
  }
  if (filter.duracaoMax !== undefined && filter.duracaoMax > 0) {
    q = q.lte("duracao_segundos", filter.duracaoMax);
  }

  q = q.order("iniciada_em", { ascending: false }).range(from, to);

  const { data, count, error } = await q;
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("ligacoes") || msg.includes("schema cache")) {
      console.warn("[ligacoes] tabela indisponível — retornando vazio");
      return { ligacoes: [], total: 0, page, pageSize, totalPages: 0 };
    }
    console.error("[ligacoes] listLigacoes error:", msg);
    return { ligacoes: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const ligacoes = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    tipo: row.tipo as string,
    direcao: row.direcao as string,
    status: row.status as string,
    numero: row.numero as string,
    contato_nome: (row.contato_nome as string | null) ?? null,
    colaborador_id: (row.colaborador_id as string | null) ?? null,
    colaborador_nome: ((row.colaborador as { nome?: string } | null) ?? null)?.nome ?? null,
    iniciada_em: row.iniciada_em as string,
    finalizada_em: (row.finalizada_em as string | null) ?? null,
    duracao_segundos: (row.duracao_segundos as number) ?? 0,
    observacoes: (row.observacoes as string | null) ?? null,
    gravacao_url: (row.gravacao_url as string | null) ?? null,
    transcricao: (row.transcricao as string | null) ?? null,
    resumo_ia: (row.resumo_ia as string | null) ?? null,
    origem: row.origem as string,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    lead_id: (row.lead_id as string | null) ?? null,
    lead_gerado_id: (row.lead_gerado_id as string | null) ?? null,
    client_id: (row.client_id as string | null) ?? null,
    client_nome: ((row.client as { nome?: string } | null) ?? null)?.nome ?? null,
  }));

  const total = count ?? 0;
  return { ligacoes, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listLigacoes(
  organizationId: string,
  filter: ListLigacoesFilter = {},
): Promise<ListLigacoesResult> {
  const cached = unstable_cache(
    async (orgId: string, filterJson: string) => {
      const f = JSON.parse(filterJson) as ListLigacoesFilter;
      return _listLigacoesImpl(orgId, f);
    },
    ["ligacoes-list"],
    { revalidate: LIGACOES_REVALIDATE_SECONDS, tags: [LIGACOES_TAG] },
  );
  return cached(organizationId, JSON.stringify(filter));
}

export interface MetricasGerais {
  total: number;
  atendidas: number;
  perdidas: number;
  rejeitadas: number;
  outras: number;
  duracao_total_seg: number;
  duracao_media_seg: number;
  clientes_unicos: number;
  por_tipo: { telefone: number; whatsapp: number };
  /** Comparativo vs período anterior (mesmo número de dias) */
  variacao_total_pct: number | null;
}

interface PeriodoFilter {
  desde: string;
  ate: string;
}

async function _getMetricasGeraisImpl(
  organizationId: string,
  periodo: PeriodoFilter,
): Promise<MetricasGerais> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const desdeIso = `${periodo.desde}T00:00:00Z`;
  const ateIso = `${periodo.ate}T23:59:59Z`;

  // Período anterior pra calcular variação — mesma duração que o atual,
  // imediatamente antes de `desde`.
  const desdeMs = new Date(desdeIso).getTime();
  const ateMs = new Date(ateIso).getTime();
  const durMs = ateMs - desdeMs;
  const anteriorAteIso = new Date(desdeMs - 1000).toISOString();
  const anteriorDesdeIso = new Date(desdeMs - 1000 - durMs).toISOString();

  // Roda as duas queries em paralelo — antes era sequencial (atual → depois
  // anterior). Período anterior só conta rows pra cálculo de variação.
  const [atualRes, anteriorRes] = await Promise.all([
    sb
      .from("ligacoes")
      .select("status, tipo, duracao_segundos, numero")
      .eq("organization_id", organizationId)
      .is("arquivado_em", null)
      .gte("iniciada_em", desdeIso)
      .lte("iniciada_em", ateIso),
    sb
      .from("ligacoes")
      .select("id")
      .eq("organization_id", organizationId)
      .is("arquivado_em", null)
      .gte("iniciada_em", anteriorDesdeIso)
      .lte("iniciada_em", anteriorAteIso),
  ]);

  if (atualRes.error) {
    console.warn("[ligacoes] getMetricasGerais error:", atualRes.error.message);
    return {
      total: 0, atendidas: 0, perdidas: 0, rejeitadas: 0, outras: 0,
      duracao_total_seg: 0, duracao_media_seg: 0, clientes_unicos: 0,
      por_tipo: { telefone: 0, whatsapp: 0 },
      variacao_total_pct: null,
    };
  }

  const rows = (atualRes.data ?? []) as Array<{ status: string; tipo: string; duracao_segundos: number; numero: string }>;
  const total = rows.length;
  let atendidas = 0;
  let perdidas = 0;
  let rejeitadas = 0;
  let outras = 0;
  let duracaoTotal = 0;
  let durCount = 0;
  const numerosUnicos = new Set<string>();
  const porTipo = { telefone: 0, whatsapp: 0 };

  for (const r of rows) {
    if (r.status === "atendida") {
      atendidas++;
      duracaoTotal += r.duracao_segundos ?? 0;
      durCount++;
    } else if (r.status === "perdida") perdidas++;
    else if (r.status === "rejeitada") rejeitadas++;
    else outras++;
    if (r.numero) numerosUnicos.add(r.numero);
    if (r.tipo === "telefone") porTipo.telefone++;
    else if (r.tipo === "whatsapp") porTipo.whatsapp++;
  }

  let variacao: number | null = null;
  const anterior = (anteriorRes.data ?? []) as Array<unknown>;
  if (anterior.length > 0) {
    variacao = ((total - anterior.length) / anterior.length) * 100;
  } else if (total > 0) {
    variacao = 100;
  }

  return {
    total,
    atendidas,
    perdidas,
    rejeitadas,
    outras,
    duracao_total_seg: duracaoTotal,
    duracao_media_seg: durCount > 0 ? Math.round(duracaoTotal / durCount) : 0,
    clientes_unicos: numerosUnicos.size,
    por_tipo: porTipo,
    variacao_total_pct: variacao !== null ? Math.round(variacao * 10) / 10 : null,
  };
}

export async function getMetricasGerais(
  organizationId: string,
  periodo: PeriodoFilter,
): Promise<MetricasGerais> {
  const cached = unstable_cache(
    async (orgId: string, desde: string, ate: string) => {
      return _getMetricasGeraisImpl(orgId, { desde, ate });
    },
    ["ligacoes-metricas"],
    { revalidate: LIGACOES_REVALIDATE_SECONDS, tags: [LIGACOES_TAG] },
  );
  return cached(organizationId, periodo.desde, periodo.ate);
}

export interface VolumePorDia {
  data: string;             // YYYY-MM-DD
  total: number;
  atendidas: number;
  perdidas: number;
}

async function _getVolumePorDiaImpl(
  organizationId: string,
  periodo: PeriodoFilter,
): Promise<VolumePorDia[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const desdeIso = `${periodo.desde}T00:00:00Z`;
  const ateIso = `${periodo.ate}T23:59:59Z`;

  const { data } = await sb
    .from("ligacoes")
    .select("iniciada_em, status")
    .eq("organization_id", organizationId)
    .is("arquivado_em", null)
    .gte("iniciada_em", desdeIso)
    .lte("iniciada_em", ateIso)
    .order("iniciada_em", { ascending: true });

  const rows = (data ?? []) as Array<{ iniciada_em: string; status: string }>;
  const map = new Map<string, VolumePorDia>();

  // Inicializa todos os dias do período (até vazios)
  const startDate = new Date(`${periodo.desde}T12:00:00Z`); // meio-dia evita timezone shift
  const endDate = new Date(`${periodo.ate}T12:00:00Z`);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    map.set(key, { data: key, total: 0, atendidas: 0, perdidas: 0 });
  }

  for (const r of rows) {
    const key = r.iniciada_em.slice(0, 10);
    const cur = map.get(key) ?? { data: key, total: 0, atendidas: 0, perdidas: 0 };
    cur.total++;
    if (r.status === "atendida") cur.atendidas++;
    else if (r.status === "perdida") cur.perdidas++;
    map.set(key, cur);
  }

  return [...map.values()].sort((a, b) => a.data.localeCompare(b.data));
}

export async function getVolumePorDia(
  organizationId: string,
  periodo: PeriodoFilter,
): Promise<VolumePorDia[]> {
  const cached = unstable_cache(
    async (orgId: string, desde: string, ate: string) => {
      return _getVolumePorDiaImpl(orgId, { desde, ate });
    },
    ["ligacoes-volume-dia"],
    { revalidate: LIGACOES_REVALIDATE_SECONDS, tags: [LIGACOES_TAG] },
  );
  return cached(organizationId, periodo.desde, periodo.ate);
}

export interface HeatmapCell {
  /** 0=Domingo, 6=Sábado */
  diaSemana: number;
  /** 0-23 */
  hora: number;
  count: number;
}

async function _getHeatmapHorariosImpl(
  organizationId: string,
  periodo: PeriodoFilter,
): Promise<HeatmapCell[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const desdeIso = `${periodo.desde}T00:00:00Z`;
  const ateIso = `${periodo.ate}T23:59:59Z`;

  const { data } = await sb
    .from("ligacoes")
    .select("iniciada_em")
    .eq("organization_id", organizationId)
    .is("arquivado_em", null)
    .gte("iniciada_em", desdeIso)
    .lte("iniciada_em", ateIso);

  const rows = (data ?? []) as Array<{ iniciada_em: string }>;
  // Inicializa matriz 7×24 com zeros
  const map = new Map<string, HeatmapCell>();
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      map.set(`${d}:${h}`, { diaSemana: d, hora: h, count: 0 });
    }
  }

  for (const r of rows) {
    // Considera horário do fuso da app (Cuiabá UTC-4, sem DST).
    const parts = getDatePartsInAppTz(new Date(r.iniciada_em));
    const dia = parts.weekday;
    const hora = parseInt(parts.hour, 10);
    const key = `${dia}:${hora}`;
    const cur = map.get(key);
    if (cur) {
      cur.count++;
    }
  }

  return [...map.values()];
}

export async function getHeatmapHorarios(
  organizationId: string,
  periodo: PeriodoFilter,
): Promise<HeatmapCell[]> {
  const cached = unstable_cache(
    async (orgId: string, desde: string, ate: string) => {
      return _getHeatmapHorariosImpl(orgId, { desde, ate });
    },
    ["ligacoes-heatmap"],
    { revalidate: LIGACOES_REVALIDATE_SECONDS, tags: [LIGACOES_TAG] },
  );
  return cached(organizationId, periodo.desde, periodo.ate);
}

export interface RankingColaborador {
  colaborador_id: string;
  colaborador_nome: string;
  avatar_url: string | null;
  role: string;
  total: number;
  atendidas: number;
  perdidas: number;
  rejeitadas: number;
  duracao_total_seg: number;
  duracao_media_seg: number;
  taxa_atendimento_pct: number;
}

async function _getRankingColaboradoresImpl(
  organizationId: string,
  periodo: PeriodoFilter,
): Promise<RankingColaborador[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const desdeIso = `${periodo.desde}T00:00:00Z`;
  const ateIso = `${periodo.ate}T23:59:59Z`;

  const { data } = await sb
    .from("ligacoes")
    .select("colaborador_id, status, duracao_segundos, colaborador:profiles!ligacoes_colaborador_id_fkey(nome, avatar_url, role)")
    .eq("organization_id", organizationId)
    .is("arquivado_em", null)
    .gte("iniciada_em", desdeIso)
    .lte("iniciada_em", ateIso)
    .not("colaborador_id", "is", null);

  const rows = (data ?? []) as Array<{
    colaborador_id: string;
    status: string;
    duracao_segundos: number;
    colaborador: { nome: string; avatar_url: string | null; role: string } | null;
  }>;

  const map = new Map<string, RankingColaborador>();
  for (const r of rows) {
    const cur = map.get(r.colaborador_id) ?? {
      colaborador_id: r.colaborador_id,
      colaborador_nome: r.colaborador?.nome ?? "Sem nome",
      avatar_url: r.colaborador?.avatar_url ?? null,
      role: r.colaborador?.role ?? "—",
      total: 0,
      atendidas: 0,
      perdidas: 0,
      rejeitadas: 0,
      duracao_total_seg: 0,
      duracao_media_seg: 0,
      taxa_atendimento_pct: 0,
    };
    cur.total++;
    if (r.status === "atendida") {
      cur.atendidas++;
      cur.duracao_total_seg += r.duracao_segundos ?? 0;
    } else if (r.status === "perdida") cur.perdidas++;
    else if (r.status === "rejeitada") cur.rejeitadas++;
    map.set(r.colaborador_id, cur);
  }

  return [...map.values()].map((r) => ({
    ...r,
    duracao_media_seg: r.atendidas > 0 ? Math.round(r.duracao_total_seg / r.atendidas) : 0,
    taxa_atendimento_pct: r.total > 0 ? Math.round((r.atendidas / r.total) * 1000) / 10 : 0,
  })).sort((a, b) => b.total - a.total);
}

export async function getRankingColaboradores(
  organizationId: string,
  periodo: PeriodoFilter,
): Promise<RankingColaborador[]> {
  const cached = unstable_cache(
    async (orgId: string, desde: string, ate: string) => {
      return _getRankingColaboradoresImpl(orgId, { desde, ate });
    },
    ["ligacoes-ranking"],
    { revalidate: LIGACOES_REVALIDATE_SECONDS, tags: [LIGACOES_TAG] },
  );
  return cached(organizationId, periodo.desde, periodo.ate);
}

/**
 * Lista colaboradores ativos pra filtros.
 * Cacheada com tag genérica "profiles" — muda raramente.
 */
async function _listColaboradoresAtivosImpl(
  organizationId: string,
): Promise<Array<{ id: string; nome: string }>> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("profiles")
    .select("id, nome")
    .eq("organization_id", organizationId)
    .eq("ativo", true)
    .in("role", ["comercial", "assessor", "coordenador", "socio", "adm"])
    .order("nome");
  return (data ?? []) as Array<{ id: string; nome: string }>;
}

export async function listColaboradoresAtivos(
  organizationId: string,
): Promise<Array<{ id: string; nome: string }>> {
  const cached = unstable_cache(
    async (orgId: string) => _listColaboradoresAtivosImpl(orgId),
    ["ligacoes-colaboradores-ativos"],
    { revalidate: 600, tags: ["profiles"] },
  );
  return cached(organizationId);
}

/**
 * Pega organization_id do perfil. Cacheado por user — não muda quase nunca.
 */
async function _getOrganizationIdImpl(userId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  return ((data as { organization_id?: string } | null) ?? null)?.organization_id ?? null;
}

export async function getOrganizationId(userId: string): Promise<string | null> {
  const cached = unstable_cache(
    async (uid: string) => _getOrganizationIdImpl(uid),
    ["ligacoes-organization-id"],
    { revalidate: 3600, tags: ["profiles"] },
  );
  return cached(userId);
}

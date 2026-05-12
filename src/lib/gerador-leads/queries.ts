// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { StatusLead } from "./tipos";

export interface LeadGeradoRow {
  id: string;
  empresa: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  dominio: string | null;
  instagram: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  categoria: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  google_maps_url: string | null;
  decisor_nome: string | null;
  decisor_cargo: string | null;
  decisor_email: string | null;
  score: number | null;
  qualificado: boolean | null;
  potencial_comercial: string | null;
  observacoes_ia: string | null;
  status: string;
  tags: string[];
  observacoes: string | null;
  responsavel_id: string | null;
  responsavel_nome?: string | null;
  fonte: string;
  created_at: string;
  updated_at: string;
}

export interface ListLeadsFilter {
  searchQuery?: string;
  status?: StatusLead | "todos";
  responsavelId?: string | null;
  cidade?: string;
  categoria?: string;
  potencial?: string;
  comWhatsapp?: boolean;
  comInstagram?: boolean;
  comSite?: boolean;
  scoreMin?: number;
  /** 1-indexed page number */
  page?: number;
  pageSize?: number;
  /** Default: created_at desc */
  orderBy?: "recentes" | "score" | "rating" | "empresa";
}

export interface ListLeadsResult {
  leads: LeadGeradoRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Lista leads_gerados com paginação + filtros.
 * Não filtra por organization_id aqui — assume RLS já restringe (todos as
 * outras tabelas seguem mesmo padrão neste projeto).
 */
export async function listLeadsGerados(
  organizationId: string,
  filter: ListLeadsFilter = {},
): Promise<ListLeadsResult> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const pageSize = Math.max(1, Math.min(200, Math.floor(filter.pageSize ?? 50)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = sb
    .from("leads_gerados")
    .select(
      "id, empresa, telefone, whatsapp, email, website, dominio, instagram, endereco, cidade, estado, categoria, google_rating, google_reviews_count, google_maps_url, decisor_nome, decisor_cargo, decisor_email, score, qualificado, potencial_comercial, observacoes_ia, status, tags, observacoes, responsavel_id, fonte, created_at, updated_at, responsavel:profiles!leads_gerados_responsavel_id_fkey(nome)",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("arquivado_em", null);

  if (filter.searchQuery && filter.searchQuery.trim()) {
    q = q.ilike("empresa", `%${filter.searchQuery.trim()}%`);
  }
  if (filter.status && filter.status !== "todos") {
    q = q.eq("status", filter.status);
  }
  if (filter.responsavelId) {
    q = q.eq("responsavel_id", filter.responsavelId);
  }
  if (filter.cidade) q = q.ilike("cidade", `%${filter.cidade}%`);
  if (filter.categoria) q = q.ilike("categoria", `%${filter.categoria}%`);
  if (filter.potencial) q = q.eq("potencial_comercial", filter.potencial);
  if (filter.comWhatsapp) q = q.not("whatsapp", "is", null);
  if (filter.comInstagram) q = q.not("instagram", "is", null);
  if (filter.comSite) q = q.not("website", "is", null);
  if (filter.scoreMin && filter.scoreMin > 0) q = q.gte("score", filter.scoreMin);

  switch (filter.orderBy) {
    case "score":
      q = q.order("score", { ascending: false, nullsFirst: false });
      break;
    case "rating":
      q = q.order("google_rating", { ascending: false, nullsFirst: false });
      break;
    case "empresa":
      q = q.order("empresa", { ascending: true });
      break;
    case "recentes":
    default:
      q = q.order("created_at", { ascending: false });
      break;
  }

  q = q.range(from, to);

  const { data, count, error } = await q;
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("leads_gerados") || msg.includes("schema cache")) {
      console.warn("[gerador-leads] tabela indisponível — retornando vazio");
      return { leads: [], total: 0, page, pageSize, totalPages: 0 };
    }
    console.error("[gerador-leads] listLeads error:", msg);
    return { leads: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const leads = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    empresa: row.empresa as string,
    telefone: (row.telefone as string | null) ?? null,
    whatsapp: (row.whatsapp as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    dominio: (row.dominio as string | null) ?? null,
    instagram: (row.instagram as string | null) ?? null,
    endereco: (row.endereco as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    categoria: (row.categoria as string | null) ?? null,
    google_rating: (row.google_rating as number | null) ?? null,
    google_reviews_count: (row.google_reviews_count as number | null) ?? null,
    google_maps_url: (row.google_maps_url as string | null) ?? null,
    decisor_nome: (row.decisor_nome as string | null) ?? null,
    decisor_cargo: (row.decisor_cargo as string | null) ?? null,
    decisor_email: (row.decisor_email as string | null) ?? null,
    score: (row.score as number | null) ?? null,
    qualificado: (row.qualificado as boolean | null) ?? null,
    potencial_comercial: (row.potencial_comercial as string | null) ?? null,
    observacoes_ia: (row.observacoes_ia as string | null) ?? null,
    status: row.status as string,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    observacoes: (row.observacoes as string | null) ?? null,
    responsavel_id: (row.responsavel_id as string | null) ?? null,
    responsavel_nome: ((row.responsavel as { nome?: string } | null) ?? null)?.nome ?? null,
    fonte: row.fonte as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return { leads, total, page, pageSize, totalPages };
}

export async function getLeadGerado(id: string): Promise<LeadGeradoRow | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("leads_gerados")
    .select(
      "id, empresa, telefone, whatsapp, email, website, dominio, instagram, endereco, cidade, estado, categoria, google_rating, google_reviews_count, google_maps_url, decisor_nome, decisor_cargo, decisor_email, score, qualificado, potencial_comercial, observacoes_ia, status, tags, observacoes, responsavel_id, fonte, created_at, updated_at, responsavel:profiles!leads_gerados_responsavel_id_fkey(nome)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    empresa: row.empresa as string,
    telefone: (row.telefone as string | null) ?? null,
    whatsapp: (row.whatsapp as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    dominio: (row.dominio as string | null) ?? null,
    instagram: (row.instagram as string | null) ?? null,
    endereco: (row.endereco as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    categoria: (row.categoria as string | null) ?? null,
    google_rating: (row.google_rating as number | null) ?? null,
    google_reviews_count: (row.google_reviews_count as number | null) ?? null,
    google_maps_url: (row.google_maps_url as string | null) ?? null,
    decisor_nome: (row.decisor_nome as string | null) ?? null,
    decisor_cargo: (row.decisor_cargo as string | null) ?? null,
    decisor_email: (row.decisor_email as string | null) ?? null,
    score: (row.score as number | null) ?? null,
    qualificado: (row.qualificado as boolean | null) ?? null,
    potencial_comercial: (row.potencial_comercial as string | null) ?? null,
    observacoes_ia: (row.observacoes_ia as string | null) ?? null,
    status: row.status as string,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    observacoes: (row.observacoes as string | null) ?? null,
    responsavel_id: (row.responsavel_id as string | null) ?? null,
    responsavel_nome: ((row.responsavel as { nome?: string } | null) ?? null)?.nome ?? null,
    fonte: row.fonte as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export interface PesquisaRow {
  id: string;
  nicho: string;
  cidade: string;
  status: string;
  total_resultados: number;
  total_novos: number;
  erro_mensagem: string | null;
  criado_por_nome: string | null;
  created_at: string;
  concluido_em: string | null;
}

export async function listPesquisas(
  organizationId: string,
  limit = 20,
): Promise<PesquisaRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("leads_gerados_pesquisas")
    .select(
      "id, nicho, cidade, status, total_resultados, total_novos, erro_mensagem, created_at, concluido_em, criador:profiles!leads_gerados_pesquisas_criado_por_fkey(nome)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    nicho: row.nicho as string,
    cidade: row.cidade as string,
    status: row.status as string,
    total_resultados: (row.total_resultados as number) ?? 0,
    total_novos: (row.total_novos as number) ?? 0,
    erro_mensagem: (row.erro_mensagem as string | null) ?? null,
    created_at: row.created_at as string,
    concluido_em: (row.concluido_em as string | null) ?? null,
    criado_por_nome: ((row.criador as { nome?: string } | null) ?? null)?.nome ?? null,
  }));
}

/**
 * Pega organization_id do perfil — usado nas pages pra filtrar listagens.
 */
export async function getOrganizationId(userId: string): Promise<string | null> {
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

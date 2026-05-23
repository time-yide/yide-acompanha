// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Pacotes que fazem postagens em rede social.
 * Filtra fora pacotes "trafego" puro e "audiovisual" puro (esses não tem
 * componente de social media - só anúncios pagos / vídeos brutos).
 *
 * Critério: pacotes com `design: 1` na PACOTE_COLUMNS matrix.
 */
export const PACOTES_COM_SOCIAL_MEDIA = [
  "trafego_estrategia",
  "estrategia",
  "yide_360",
] as const;

export interface ClienteSocialRow {
  id: string;
  nome: string;
  tipo_pacote: string;
  assessor_id: string | null;
  coordenador_id: string | null;
  designer_id: string | null;
  instagram_business_id: string | null;
  facebook_page_id: string | null;
  total_posts: number;
  posts_agendados: number;
  posts_publicados: number;
}

export async function listClientesSocial(filter: {
  assessorId?: string | null;
  coordenadorId?: string | null;
  designerId?: string | null;
  searchQuery?: string;
  /** Multi-tenant: quando passado, filtra por unidade. */
  unitId?: string | null;
} = {}): Promise<ClienteSocialRow[]> {
  const supabase = createServiceRoleClient();

  const buildQuery = (selectStr: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("clients")
      .select(selectStr)
      .eq("status", "ativo")
      .in("tipo_pacote", [...PACOTES_COM_SOCIAL_MEDIA]);
    if (filter.unitId) q = q.eq("unit_id", filter.unitId);
    if (filter.assessorId) q = q.eq("assessor_id", filter.assessorId);
    if (filter.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
    if (filter.designerId) q = q.eq("designer_id", filter.designerId);
    if (filter.searchQuery && filter.searchQuery.trim()) {
      q = q.ilike("nome", `%${filter.searchQuery.trim()}%`);
    }
    return q.order("nome");
  };

  const SELECT_COMPLETO = "id, nome, tipo_pacote, assessor_id, coordenador_id, designer_id, instagram_business_id, facebook_page_id";
  const SELECT_FALLBACK = "id, nome, tipo_pacote, assessor_id, coordenador_id, designer_id";

  let resp = await buildQuery(SELECT_COMPLETO);
  if (resp.error) {
    const msg = resp.error.message ?? "";
    if (msg.includes("instagram_business_id") || msg.includes("facebook_page_id") || msg.includes("schema cache")) {
      console.warn("[social] colunas de redes indisponíveis - usando fallback");
      resp = await buildQuery(SELECT_FALLBACK);
    }
  }
  const clients = ((resp.data ?? []) as unknown as Array<{
    id: string;
    nome: string;
    tipo_pacote: string;
    assessor_id: string | null;
    coordenador_id: string | null;
    designer_id: string | null;
    instagram_business_id?: string | null;
    facebook_page_id?: string | null;
  }>);

  if (clients.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let postsResp = await sb
    .from("social_media_posts")
    .select("client_id, status")
    .in("client_id", clients.map((c) => c.id))
    .is("archived_at", null);

  // Tabela pode não existir ainda (migration não rodada)
  if (postsResp.error) {
    const msg = postsResp.error.message ?? "";
    if (msg.includes("social_media_posts") || msg.includes("schema cache")) {
      console.warn("[social] tabela social_media_posts indisponível - fallback vazio");
      postsResp = { data: [] } as { data: Array<{ client_id: string; status: string }> };
    }
  }

  const posts = (postsResp.data ?? []) as Array<{ client_id: string; status: string }>;
  const countByClient = new Map<string, { total: number; agendados: number; publicados: number }>();
  for (const p of posts) {
    const cur = countByClient.get(p.client_id) ?? { total: 0, agendados: 0, publicados: 0 };
    cur.total += 1;
    if (p.status === "agendado") cur.agendados += 1;
    if (p.status === "publicado") cur.publicados += 1;
    countByClient.set(p.client_id, cur);
  }

  return clients.map((c) => {
    const cnt = countByClient.get(c.id) ?? { total: 0, agendados: 0, publicados: 0 };
    return {
      id: c.id,
      nome: c.nome,
      tipo_pacote: c.tipo_pacote,
      assessor_id: c.assessor_id,
      coordenador_id: c.coordenador_id,
      designer_id: c.designer_id,
      instagram_business_id: c.instagram_business_id ?? null,
      facebook_page_id: c.facebook_page_id ?? null,
      total_posts: cnt.total,
      posts_agendados: cnt.agendados,
      posts_publicados: cnt.publicados,
    };
  });
}

export interface SocialPostRow {
  id: string;
  client_id: string;
  titulo: string | null;
  legenda: string | null;
  primeiro_comentario: string | null;
  hashtags: string | null;
  formato: string;
  redes: string[];
  midias: string[];
  agendar_para: string | null;
  status: string;
  observacoes: string | null;
  ajuste_observacoes: string | null;
  aprovado_em: string | null;
  aprovacao_token: string | null;
  design_arte_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listPostsByCliente(clientId: string): Promise<SocialPostRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("social_media_posts")
    .select("*")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("agendar_para", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[social] erro ao listar posts:", error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    client_id: row.client_id as string,
    titulo: (row.titulo as string | null) ?? null,
    legenda: (row.legenda as string | null) ?? null,
    primeiro_comentario: (row.primeiro_comentario as string | null) ?? null,
    hashtags: (row.hashtags as string | null) ?? null,
    formato: row.formato as string,
    redes: Array.isArray(row.redes) ? (row.redes as string[]) : [],
    midias: Array.isArray(row.midias) ? (row.midias as string[]) : [],
    agendar_para: (row.agendar_para as string | null) ?? null,
    status: row.status as string,
    observacoes: (row.observacoes as string | null) ?? null,
    ajuste_observacoes: (row.ajuste_observacoes as string | null) ?? null,
    aprovado_em: (row.aprovado_em as string | null) ?? null,
    aprovacao_token: (row.aprovacao_token as string | null) ?? null,
    design_arte_id: (row.design_arte_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

export interface ClienteSocialDetalhe {
  id: string;
  nome: string;
  tipo_pacote: string;
  designer_id: string | null;
  designer_nome: string | null;
  instagram_business_id: string | null;
  facebook_page_id: string | null;
  linkedin_company_id: string | null;
  gmn_location_id: string | null;
}

export async function getClienteSocial(clientId: string): Promise<ClienteSocialDetalhe | null> {
  const supabase = createServiceRoleClient();

  const buildQuery = (selectStr: string) =>
    supabase.from("clients").select(selectStr).eq("id", clientId).maybeSingle();

  const SELECT_COMPLETO =
    "id, nome, tipo_pacote, designer_id, instagram_business_id, facebook_page_id, linkedin_company_id, gmn_location_id, designer:profiles!clients_designer_id_fkey(nome)";
  const SELECT_FALLBACK = "id, nome, tipo_pacote, designer_id";

  let resp = await buildQuery(SELECT_COMPLETO);
  if (resp.error) {
    const msg = resp.error.message ?? "";
    if (msg.includes("instagram_business_id") || msg.includes("schema cache")) {
      resp = await buildQuery(SELECT_FALLBACK);
    }
  }
  if (!resp.data) return null;
  const c = resp.data as unknown as {
    id: string;
    nome: string;
    tipo_pacote: string;
    designer_id: string | null;
    instagram_business_id?: string | null;
    facebook_page_id?: string | null;
    linkedin_company_id?: string | null;
    gmn_location_id?: string | null;
    designer?: { nome: string } | null;
  };
  return {
    id: c.id,
    nome: c.nome,
    tipo_pacote: c.tipo_pacote,
    designer_id: c.designer_id,
    designer_nome: c.designer?.nome ?? null,
    instagram_business_id: c.instagram_business_id ?? null,
    facebook_page_id: c.facebook_page_id ?? null,
    linkedin_company_id: c.linkedin_company_id ?? null,
    gmn_location_id: c.gmn_location_id ?? null,
  };
}

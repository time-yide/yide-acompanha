// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { StyleGuide } from "./tipos";
import { STYLE_GUIDE_VAZIO } from "./tipos";

export interface ClienteDesignRow {
  id: string;
  nome: string;
  tipo_pacote: string;
  assessor_id: string | null;
  coordenador_id: string | null;
  designer_id: string | null;
  total_artes: number;
  artes_aguardando: number;
  artes_aprovadas: number;
  tem_style_guide: boolean;
}

export async function listClientesDesign(filter: {
  assessorId?: string | null;
  coordenadorId?: string | null;
  designerId?: string | null;
  searchQuery?: string;
  /** Multi-tenant: quando passado, filtra por unidade. */
  unitId?: string | null;
} = {}): Promise<ClienteDesignRow[]> {
  const supabase = createServiceRoleClient();

  const buildClientsQuery = (selectStr: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("clients")
      .select(selectStr)
      .eq("status", "ativo");
    if (filter.unitId) q = q.eq("unit_id", filter.unitId);
    if (filter.assessorId) q = q.eq("assessor_id", filter.assessorId);
    if (filter.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
    if (filter.designerId) q = q.eq("designer_id", filter.designerId);
    if (filter.searchQuery && filter.searchQuery.trim()) {
      q = q.ilike("nome", `%${filter.searchQuery.trim()}%`);
    }
    return q.order("nome");
  };

  const SELECT_COMPLETO = "id, nome, tipo_pacote, assessor_id, coordenador_id, designer_id, design_style_guide";
  const SELECT_FALLBACK = "id, nome, tipo_pacote, assessor_id, coordenador_id, designer_id";

  let resp = await buildClientsQuery(SELECT_COMPLETO);
  if (resp.error) {
    const msg = resp.error.message ?? "";
    if (msg.includes("design_style_guide") || msg.includes("schema cache")) {
      console.warn("[design] design_style_guide indisponível - usando fallback");
      resp = await buildClientsQuery(SELECT_FALLBACK);
    }
  }
  const clients = ((resp.data ?? []) as unknown as Array<{
    id: string;
    nome: string;
    tipo_pacote: string;
    assessor_id: string | null;
    coordenador_id: string | null;
    designer_id: string | null;
    design_style_guide?: Record<string, unknown> | null;
  }>);

  if (clients.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: artesData } = await sb
    .from("design_artes")
    .select("client_id, status")
    .in("client_id", clients.map((c) => c.id))
    .is("archived_at", null);

  const artes = (artesData ?? []) as Array<{ client_id: string; status: string }>;
  const countByClient = new Map<string, { total: number; aguardando: number; aprovadas: number }>();
  for (const a of artes) {
    const cur = countByClient.get(a.client_id) ?? { total: 0, aguardando: 0, aprovadas: 0 };
    cur.total += 1;
    if (a.status === "aguardando_aprovacao" || a.status === "ajustes_solicitados") cur.aguardando += 1;
    if (a.status === "aprovado" || a.status === "agendado" || a.status === "publicado") cur.aprovadas += 1;
    countByClient.set(a.client_id, cur);
  }

  return clients.map((c) => {
    const cnt = countByClient.get(c.id) ?? { total: 0, aguardando: 0, aprovadas: 0 };
    const styleGuide = (c.design_style_guide ?? {}) as Record<string, unknown>;
    const tem = Object.keys(styleGuide).length > 0 && Object.values(styleGuide).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "string") return v.trim().length > 0;
      return false;
    });
    return {
      id: c.id,
      nome: c.nome,
      tipo_pacote: c.tipo_pacote,
      assessor_id: c.assessor_id,
      coordenador_id: c.coordenador_id,
      designer_id: c.designer_id,
      total_artes: cnt.total,
      artes_aguardando: cnt.aguardando,
      artes_aprovadas: cnt.aprovadas,
      tem_style_guide: tem,
    };
  });
}

export interface ArteRow {
  id: string;
  client_id: string;
  titulo: string;
  descricao: string | null;
  formato: string;
  status: string;
  midias: string[];
  copy: string | null;
  hashtags: string | null;
  observacoes: string | null;
  fonte_origem: string;
  ai_modelo: string | null;
  ai_prompt: string | null;
  agendado_para: string | null;
  publicado_em: string | null;
  aprovado_em: string | null;
  ajuste_observacoes: string | null;
  aprovacao_token: string | null;
  created_at: string;
  updated_at: string;
}

export async function listArtesByCliente(clientId: string): Promise<ArteRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("design_artes")
    .select("id, client_id, titulo, descricao, formato, status, midias, copy, hashtags, observacoes, fonte_origem, ai_modelo, ai_prompt, agendado_para, publicado_em, aprovado_em, ajuste_observacoes, aprovacao_token, created_at, updated_at")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    client_id: row.client_id as string,
    titulo: row.titulo as string,
    descricao: (row.descricao as string | null) ?? null,
    formato: row.formato as string,
    status: row.status as string,
    midias: Array.isArray(row.midias) ? (row.midias as string[]) : [],
    copy: (row.copy as string | null) ?? null,
    hashtags: (row.hashtags as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    fonte_origem: row.fonte_origem as string,
    ai_modelo: (row.ai_modelo as string | null) ?? null,
    ai_prompt: (row.ai_prompt as string | null) ?? null,
    agendado_para: (row.agendado_para as string | null) ?? null,
    publicado_em: (row.publicado_em as string | null) ?? null,
    aprovado_em: (row.aprovado_em as string | null) ?? null,
    ajuste_observacoes: (row.ajuste_observacoes as string | null) ?? null,
    aprovacao_token: (row.aprovacao_token as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

export interface ClienteDesignDetalhe {
  id: string;
  nome: string;
  tipo_pacote: string;
  designer_id: string | null;
  designer_nome: string | null;
  style_guide: StyleGuide;
}

export async function getClienteDesign(clientId: string): Promise<ClienteDesignDetalhe | null> {
  const supabase = createServiceRoleClient();

  const buildQuery = (selectStr: string) =>
    supabase.from("clients").select(selectStr).eq("id", clientId).maybeSingle();

  const SELECT_COMPLETO =
    "id, nome, tipo_pacote, designer_id, design_style_guide, designer:profiles!clients_designer_id_fkey(nome)";
  const SELECT_FALLBACK = "id, nome, tipo_pacote, designer_id";

  let resp = await buildQuery(SELECT_COMPLETO);
  if (resp.error) {
    const msg = resp.error.message ?? "";
    if (msg.includes("design_style_guide") || msg.includes("schema cache")) {
      resp = await buildQuery(SELECT_FALLBACK);
    }
  }
  if (!resp.data) return null;

  const c = resp.data as unknown as {
    id: string;
    nome: string;
    tipo_pacote: string;
    designer_id: string | null;
    design_style_guide?: Record<string, unknown> | null;
    designer?: { nome: string } | null;
  };

  const styleGuide: StyleGuide = {
    ...STYLE_GUIDE_VAZIO,
    ...(c.design_style_guide ?? {}),
  };

  return {
    id: c.id,
    nome: c.nome,
    tipo_pacote: c.tipo_pacote,
    designer_id: c.designer_id,
    designer_nome: c.designer?.nome ?? null,
    style_guide: styleGuide,
  };
}

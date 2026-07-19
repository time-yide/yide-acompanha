import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { SEED_SERVICOS } from "./config";

export interface Servico { id: string; nome: string; slug: string; descricao_base: string; ordem: number; ativo: boolean }
export interface Localidade { id: string; nome: string; tipo: "cidade" | "estado"; uf: string; slug: string; ativo: boolean }
export interface PaginaLista { id: string; service_id: string; localidade_id: string; slug: string; titulo: string; status: string }
export interface PaginaPublica {
  titulo: string; meta_title: string | null; meta_description: string | null;
  conteudo_md: string; faq: { pergunta: string; resposta: string }[];
  servicoNome: string; servicoSlug: string; localidadeNome: string; localidadeSlug: string; tipo: "cidade" | "estado"; uf: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }

export async function getOrgPadrao(): Promise<string | null> {
  const { data } = await sb().from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}
export async function listServicos(orgId: string): Promise<Servico[]> {
  const { data } = await sb().from("seo_services").select("id, nome, slug, descricao_base, ordem, ativo")
    .eq("organization_id", orgId).order("ordem", { ascending: true });
  return (data ?? []) as Servico[];
}
export async function listLocalidades(orgId: string): Promise<Localidade[]> {
  const { data } = await sb().from("seo_localidades").select("id, nome, tipo, uf, slug, ativo")
    .eq("organization_id", orgId).order("tipo", { ascending: true }).order("nome", { ascending: true });
  return (data ?? []) as Localidade[];
}
export async function listPaginas(orgId: string): Promise<PaginaLista[]> {
  const { data } = await sb().from("seo_paginas").select("id, service_id, localidade_id, slug, titulo, status")
    .eq("organization_id", orgId).neq("status", "arquivado");
  return (data ?? []) as PaginaLista[];
}
export async function getPaginaAdmin(orgId: string, id: string) {
  const { data } = await sb().from("seo_paginas").select("*").eq("organization_id", orgId).eq("id", id).maybeSingle();
  return data ?? null;
}
export async function getServicoPublicado(orgId: string, servicoSlug: string) {
  const { data } = await sb().from("seo_services").select("id, nome, slug, descricao_base")
    .eq("organization_id", orgId).eq("slug", servicoSlug).eq("ativo", true).maybeSingle();
  return data ?? null;
}
export async function getPaginaPublica(orgId: string, servicoSlug: string, localidadeSlug: string): Promise<PaginaPublica | null> {
  const { data } = await sb().from("seo_paginas")
    .select("titulo, meta_title, meta_description, conteudo_md, faq, seo_services!inner(nome, slug), seo_localidades!inner(nome, slug, tipo, uf)")
    .eq("organization_id", orgId).eq("status", "publicado")
    .eq("seo_services.slug", servicoSlug).eq("seo_localidades.slug", localidadeSlug).maybeSingle();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { titulo: d.titulo, meta_title: d.meta_title, meta_description: d.meta_description,
    conteudo_md: d.conteudo_md, faq: Array.isArray(d.faq) ? d.faq : [],
    servicoNome: d.seo_services.nome, servicoSlug: d.seo_services.slug,
    localidadeNome: d.seo_localidades.nome, localidadeSlug: d.seo_localidades.slug,
    tipo: d.seo_localidades.tipo, uf: d.seo_localidades.uf };
}
export async function listPaginasPublicadasDoServico(orgId: string, servicoSlug: string) {
  const { data } = await sb().from("seo_paginas")
    .select("titulo, seo_services!inner(slug), seo_localidades!inner(nome, slug, tipo)")
    .eq("organization_id", orgId).eq("status", "publicado").eq("seo_services.slug", servicoSlug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((d) => ({ titulo: d.titulo, localidadeNome: d.seo_localidades.nome, localidadeSlug: d.seo_localidades.slug, tipo: d.seo_localidades.tipo }));
}
export async function listServicosComPaginas(orgId: string) {
  return (await listServicos(orgId)).filter((s) => s.ativo);
}

// Serviços do banco MESCLADOS com os padrão (seed): o banco tem prioridade por
// slug, mas serviços padrão ainda não cadastrados (ex.: um serviço novo) também
// aparecem. Ordenado por `ordem`. Nunca deixa o site vazio.
export async function listServicosOuSeed(orgId: string | null): Promise<Servico[]> {
  const db = orgId ? await listServicosComPaginas(orgId) : [];
  const slugs = new Set(db.map((s) => s.slug));
  const faltando: Servico[] = SEED_SERVICOS
    .filter((s) => !slugs.has(s.slug))
    .map((s) => ({ id: `seed-${s.slug}`, nome: s.nome, slug: s.slug, descricao_base: s.descricao_base, ordem: s.ordem, ativo: true }));
  return [...db, ...faltando].sort((a, b) => a.ordem - b.ordem);
}

// Um serviço pelo slug (banco); fallback nos serviços padrão. Devolve null se
// o slug não existe em lugar nenhum (aí a página-âncora dá 404 mesmo).
export async function getServicoOuSeed(orgId: string | null, slug: string): Promise<{ id: string; nome: string; slug: string; descricao_base: string } | null> {
  if (orgId) {
    const s = await getServicoPublicado(orgId, slug);
    if (s) return s as { id: string; nome: string; slug: string; descricao_base: string };
  }
  const seed = SEED_SERVICOS.find((s) => s.slug === slug);
  return seed ? { id: `seed-${seed.slug}`, nome: seed.nome, slug: seed.slug, descricao_base: seed.descricao_base } : null;
}

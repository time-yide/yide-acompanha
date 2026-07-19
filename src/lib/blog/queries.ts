// SERVER ONLY — leitura de posts do blog (admin + público). Service-role.
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface BlogPostRow {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  conteudo_md: string;
  cover_image_url: string | null;
  status: string;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string[];
  fonte_url: string | null;
  fonte_nome: string | null;
  autor_id: string | null;
  autor_nome: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogPostPublic = Omit<BlogPostRow, "id" | "status" | "autor_id" | "created_at">;

const SELECT_FULL =
  "id, slug, titulo, resumo, conteudo_md, cover_image_url, status, meta_title, meta_description, keywords, fonte_url, fonte_nome, autor_id, published_at, created_at, updated_at, autor:profiles!blog_posts_autor_id_fkey(nome)";

function mapRow(r: Record<string, unknown>): BlogPostRow {
  return {
    id: r.id as string,
    slug: r.slug as string,
    titulo: r.titulo as string,
    resumo: (r.resumo as string | null) ?? null,
    conteudo_md: (r.conteudo_md as string | null) ?? "",
    cover_image_url: (r.cover_image_url as string | null) ?? null,
    status: r.status as string,
    meta_title: (r.meta_title as string | null) ?? null,
    meta_description: (r.meta_description as string | null) ?? null,
    keywords: (r.keywords as string[] | null) ?? [],
    fonte_url: (r.fonte_url as string | null) ?? null,
    fonte_nome: (r.fonte_nome as string | null) ?? null,
    autor_id: (r.autor_id as string | null) ?? null,
    autor_nome: ((r.autor as { nome?: string } | null) ?? null)?.nome ?? null,
    published_at: (r.published_at as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

/** Org "padrão" do blog: a primeira organização (o sistema é single-org na prática). */
export async function getOrgPadraoBlog(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb.from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return ((data as { id?: string } | null) ?? null)?.id ?? null;
}

export async function listPostsAdmin(orgId: string): Promise<BlogPostRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("blog_posts")
    .select(SELECT_FULL)
    .eq("organization_id", orgId)
    .neq("status", "arquivado")
    .order("updated_at", { ascending: false });
  if (error) { console.error("[blog] listPostsAdmin", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export async function getPostAdmin(orgId: string, id: string): Promise<BlogPostRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb.from("blog_posts").select(SELECT_FULL)
    .eq("organization_id", orgId).eq("id", id).maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function listPostsPublicados(orgId: string): Promise<BlogPostPublic[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("blog_posts")
    .select(SELECT_FULL)
    .eq("organization_id", orgId)
    .eq("status", "publicado")
    .order("published_at", { ascending: false });
  if (error) { console.error("[blog] listPostsPublicados", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export async function getPostPublicadoPorSlug(orgId: string, slug: string): Promise<BlogPostPublic | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb.from("blog_posts").select(SELECT_FULL)
    .eq("organization_id", orgId).eq("slug", slug).eq("status", "publicado").maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/** Slugs já usados na org — pra garantir unicidade ao criar/editar. */
export async function slugsExistentes(orgId: string, exceptId?: string): Promise<Set<string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb.from("blog_posts").select("slug, id").eq("organization_id", orgId);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q;
  return new Set(((data ?? []) as Array<{ slug: string }>).map((r) => r.slug));
}

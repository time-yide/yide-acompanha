"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "./acesso";
import { parseBoolCampo } from "./form";
import { slugify, slugUnico } from "./slug";
import { slugsExistentes } from "./queries";
import { executarPipelineBlog } from "./pipeline/executar";
import { gerarTendencias, gerarRascunhoDeTema } from "./pipeline/tendencias";

interface Ok { success: true; id?: string }
interface Err { error: string }
type Result = Ok | Err;

const uuidLike = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "ID inválido");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sbAdmin(): any {
  return createServiceRoleClient();
}

function revalida(slug?: string) {
  revalidatePath("/programacao/blog");
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
}

async function gate(): Promise<{ orgId: string; actorId: string } | { error: string }> {
  const actor = await requireAuth();
  if (!podeGerenciarBlog(actor.role)) return { error: "Sem permissão pra gerenciar o blog" };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Sem organização" };
  return { orgId, actorId: actor.id };
}

const criarSchema = z.object({ titulo: z.string().trim().min(1, "Informe um título") });

export async function criarPostAction(formData: FormData): Promise<Result> {
  const g = await gate();
  if ("error" in g) return g;
  const parsed = criarSchema.safeParse({ titulo: formData.get("titulo") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const slug = slugUnico(slugify(parsed.data.titulo), await slugsExistentes(g.orgId));
  const { data, error } = await sbAdmin().from("blog_posts")
    .insert({ organization_id: g.orgId, slug, titulo: parsed.data.titulo, autor_id: g.actorId, status: "rascunho" })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Falha ao criar post" };
  revalida();
  return { success: true, id: data.id as string };
}

const atualizarSchema = z.object({
  id: uuidLike,
  titulo: z.string().trim().min(1, "Informe um título"),
  slug: z.string().trim().optional(),
  resumo: z.string().trim().max(300).nullable().optional(),
  conteudo_md: z.string().default(""),
  cover_image_url: z.string().url().nullable().optional().or(z.literal("")),
  meta_title: z.string().trim().max(70).nullable().optional(),
  meta_description: z.string().trim().max(160).nullable().optional(),
  keywords: z.string().optional(), // csv
  fonte_url: z.string().url().nullable().optional().or(z.literal("")),
  fonte_nome: z.string().trim().max(120).nullable().optional(),
});

export async function atualizarPostAction(formData: FormData): Promise<Result> {
  const g = await gate();
  if ("error" in g) return g;
  const parsed = atualizarSchema.safeParse({
    id: formData.get("id"),
    titulo: formData.get("titulo"),
    slug: formData.get("slug") ?? undefined,
    resumo: (formData.get("resumo") as string) || null,
    conteudo_md: formData.get("conteudo_md") ?? "",
    cover_image_url: (formData.get("cover_image_url") as string) || null,
    meta_title: (formData.get("meta_title") as string) || null,
    meta_description: (formData.get("meta_description") as string) || null,
    keywords: formData.get("keywords") ?? undefined,
    fonte_url: (formData.get("fonte_url") as string) || null,
    fonte_nome: (formData.get("fonte_nome") as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const slugBase = slugify(d.slug && d.slug.length > 0 ? d.slug : d.titulo);
  const slug = slugUnico(slugBase, await slugsExistentes(g.orgId, d.id));
  const keywords = (d.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean);

  const { data, error } = await sbAdmin().from("blog_posts")
    .update({
      titulo: d.titulo,
      slug,
      resumo: d.resumo || null,
      conteudo_md: d.conteudo_md ?? "",
      cover_image_url: d.cover_image_url || null,
      meta_title: d.meta_title || null,
      meta_description: d.meta_description || null,
      keywords,
      fonte_url: d.fonte_url || null,
      fonte_nome: d.fonte_nome || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", d.id).eq("organization_id", g.orgId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Post não encontrado" };
  revalida(slug);
  return { success: true, id: d.id };
}

const publicarSchema = z.object({ id: uuidLike, publicar: z.boolean() });

export async function publicarPostAction(formData: FormData): Promise<Result> {
  const g = await gate();
  if ("error" in g) return g;
  const parsed = publicarSchema.safeParse({ id: formData.get("id"), publicar: parseBoolCampo(formData.get("publicar")) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = sbAdmin();
  const patch: Record<string, unknown> = {
    status: parsed.data.publicar ? "publicado" : "rascunho",
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.publicar) {
    // Seta published_at só na 1ª publicação (mantém a data original em re-publicações).
    const { data: atual } = await sb.from("blog_posts").select("published_at, slug").eq("id", parsed.data.id).eq("organization_id", g.orgId).maybeSingle();
    if (atual && !atual.published_at) patch.published_at = new Date().toISOString();
  }
  const { data, error } = await sb.from("blog_posts").update(patch)
    .eq("id", parsed.data.id).eq("organization_id", g.orgId).select("slug");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Post não encontrado" };
  revalida((data[0] as { slug: string }).slug);
  return { success: true };
}

interface GerarOk { success: true; gerados: number; semNovas: boolean }
export async function gerarRascunhosAgoraAction(): Promise<GerarOk | Err> {
  const g = await gate();
  if ("error" in g) return g;
  // Manual = 1 rascunho (rápido, pra testar). O cron diário gera 2–3.
  const r = await executarPipelineBlog(g.orgId, 1);
  revalida();
  return { success: true, gerados: r.gerados, semNovas: r.semNovas };
}

export async function atualizarTendenciasAction(): Promise<{ success: true; total: number } | Err> {
  const g = await gate();
  if ("error" in g) return g;
  const r = await gerarTendencias(g.orgId);
  revalidatePath("/programacao/blog/insights");
  if (!r.ok) return { error: "Não consegui atualizar as tendências agora. Tente de novo em instantes." };
  return { success: true, total: r.total };
}

export async function gerarRascunhoDeTemaAction(formData: FormData): Promise<Ok | Err> {
  const g = await gate();
  if ("error" in g) return g;
  const tema = String(formData.get("tema") ?? "").trim();
  const angulo = String(formData.get("angulo") ?? "").trim();
  if (!tema) return { error: "Tema vazio" };
  const id = await gerarRascunhoDeTema(g.orgId, tema, angulo);
  revalida();
  if (!id) return { error: "Não consegui gerar o rascunho agora. Tente de novo." };
  return { success: true, id };
}

export async function arquivarPostAction(id: string): Promise<Result> {
  const g = await gate();
  if ("error" in g) return g;
  const { data, error } = await sbAdmin().from("blog_posts")
    .update({ status: "arquivado", updated_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", g.orgId).select("slug");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Post não encontrado" };
  revalida((data[0] as { slug: string }).slug);
  return { success: true };
}

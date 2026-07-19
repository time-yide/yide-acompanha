"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { parseBoolCampo } from "@/lib/blog/form";
import { slugify, slugUnico } from "@/lib/blog/slug";
import { garantirSeedSeo } from "./seed";
import { listServicos, listLocalidades, listPaginas } from "./queries";
import { gerarPaginasPendentes, gerarPaginaLocal } from "./pipeline";

interface Ok { success: true } interface Err { error: string } type Result = Ok | Err;
const uuidLike = z.string().regex(/^[0-9a-fA-F-]{36}$/, "ID inválido");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }
async function gate(): Promise<{ orgId: string } | Err> {
  const actor = await requireAuth();
  if (!podeGerenciarBlog(actor.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Sem organização" };
  return { orgId };
}
function revalida() { revalidatePath("/programacao/seo"); revalidatePath("/servicos"); }

export async function seedSeoAction(): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  await garantirSeedSeo(g.orgId); revalida(); return { success: true };
}
export async function gerarPendentesAction(): Promise<{ success: true; gerados: number; erros: number } | Err> {
  const g = await gate(); if ("error" in g) return g;
  await garantirSeedSeo(g.orgId);
  const [servicos, localidades, paginas] = await Promise.all([listServicos(g.orgId), listLocalidades(g.orgId), listPaginas(g.orgId)]);
  const jaExistem = new Set(paginas.map((p) => `${p.service_id}:${p.localidade_id}`));
  const r = await gerarPaginasPendentes(g.orgId, servicos, localidades, jaExistem, 4);
  revalida(); return { success: true, ...r };
}
export async function gerarUmaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const parsed = z.object({ serviceId: uuidLike, localidadeId: uuidLike }).safeParse({ serviceId: formData.get("serviceId"), localidadeId: formData.get("localidadeId") });
  if (!parsed.success) return { error: "Dados inválidos" };
  const [servicos, localidades] = await Promise.all([listServicos(g.orgId), listLocalidades(g.orgId)]);
  const s = servicos.find((x) => x.id === parsed.data.serviceId); const l = localidades.find((x) => x.id === parsed.data.localidadeId);
  if (!s || !l) return { error: "Serviço/localidade não encontrado" };
  const ok = await gerarPaginaLocal(g.orgId, s, l); revalida();
  return ok ? { success: true } : { error: "Não consegui gerar agora." };
}
export async function publicarPaginaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const parsed = z.object({ id: uuidLike, publicar: z.boolean() }).safeParse({ id: formData.get("id"), publicar: parseBoolCampo(formData.get("publicar")) });
  if (!parsed.success) return { error: "Dados inválidos" };
  const { data, error } = await sb().from("seo_paginas")
    .update({ status: parsed.data.publicar ? "publicado" : "rascunho", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Página não encontrada" };
  revalida(); return { success: true };
}
export async function salvarPaginaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const id = String(formData.get("id") ?? ""); const titulo = String(formData.get("titulo") ?? "").trim();
  const conteudo_md = String(formData.get("conteudo_md") ?? "");
  const meta_title = String(formData.get("meta_title") ?? "").trim();
  const meta_description = String(formData.get("meta_description") ?? "").trim();
  if (!uuidLike.safeParse(id).success || !titulo) return { error: "Dados inválidos" };
  const { data, error } = await sb().from("seo_paginas")
    .update({ titulo, conteudo_md, meta_title, meta_description, updated_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Página não encontrada" };
  revalida(); return { success: true };
}
export async function addLocalidadeAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const nome = String(formData.get("nome") ?? "").trim(); const tipo = String(formData.get("tipo") ?? "");
  const uf = String(formData.get("uf") ?? "").trim().toUpperCase().slice(0, 2);
  if (!nome || (tipo !== "cidade" && tipo !== "estado")) return { error: "Dados inválidos" };
  const existentes = await listLocalidades(g.orgId);
  const slug = slugUnico(slugify(nome), new Set(existentes.map((l) => l.slug)));
  const { error } = await sb().from("seo_localidades").insert({ organization_id: g.orgId, nome, tipo, uf, slug });
  if (error) return { error: error.message };
  revalida(); return { success: true };
}

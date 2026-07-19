"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { parseBoolCampo } from "@/lib/blog/form";
import { slugUnico } from "@/lib/blog/slug";
import { baseSlugCase } from "./case-slug";
import { listCasesAdmin, type Resultado } from "./case-queries";
import { polirCase } from "./case-pipeline";

interface Err { error: string } type Result = { success: true } | Err;
const uuidLike = z.string().regex(/^[0-9a-fA-F-]{36}$/, "ID inválido");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }
async function gate(): Promise<{ orgId: string } | Err> {
  const a = await requireAuth();
  if (!podeGerenciarBlog(a.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(a.id);
  if (!orgId) return { error: "Sem organização" };
  return { orgId };
}
function revalida() { revalidatePath("/programacao/seo/cases"); revalidatePath("/cases"); }
function parseResultados(raw: FormDataEntryValue | null): Resultado[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((r) => r && typeof r.rotulo === "string" && typeof r.valor === "string")
      .map((r) => ({ rotulo: String(r.rotulo).trim(), valor: String(r.valor).trim() })).filter((r) => r.rotulo || r.valor);
  } catch { return []; }
}

export async function criarCaseAction(): Promise<{ success: true; id: string } | Err> {
  const g = await gate(); if ("error" in g) return g;
  const existentes = await listCasesAdmin(g.orgId);
  const slug = slugUnico(baseSlugCase("Novo case", ""), new Set(existentes.map((c) => c.slug)));
  const { data, error } = await sb().from("seo_cases").insert({ organization_id: g.orgId, slug, cliente: "Novo case" }).select("id").maybeSingle();
  if (error) return { error: error.message };
  revalida();
  return { success: true, id: (data as { id: string }).id };
}

export async function salvarCaseAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const id = String(formData.get("id") ?? "");
  if (!uuidLike.safeParse(id).success) return { error: "ID inválido" };
  const cliente = String(formData.get("cliente") ?? "").trim();
  if (!cliente) return { error: "Informe o cliente" };
  const patch = {
    cliente, segmento: String(formData.get("segmento") ?? "").trim(),
    localidade: String(formData.get("localidade") ?? "").trim(),
    desafio: String(formData.get("desafio") ?? ""), solucao: String(formData.get("solucao") ?? ""),
    resultados: parseResultados(formData.get("resultados")),
    depoimento_texto: String(formData.get("depoimento_texto") ?? "").trim(),
    depoimento_autor: String(formData.get("depoimento_autor") ?? "").trim(),
    cover_image_url: String(formData.get("cover_image_url") ?? "").trim() || null,
    conteudo_md: String(formData.get("conteudo_md") ?? ""),
    meta_title: String(formData.get("meta_title") ?? "").trim(),
    meta_description: String(formData.get("meta_description") ?? "").trim(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb().from("seo_cases").update(patch).eq("id", id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Case não encontrado" };
  revalida();
  return { success: true };
}

export async function polirCaseAction(formData: FormData): Promise<{ success: true; conteudo_md: string; meta_title: string; meta_description: string } | Err> {
  const g = await gate(); if ("error" in g) return g;
  const dados = {
    cliente: String(formData.get("cliente") ?? ""), segmento: String(formData.get("segmento") ?? ""),
    localidade: String(formData.get("localidade") ?? ""), desafio: String(formData.get("desafio") ?? ""),
    solucao: String(formData.get("solucao") ?? ""), resultados: parseResultados(formData.get("resultados")),
    depoimento_texto: String(formData.get("depoimento_texto") ?? ""), depoimento_autor: String(formData.get("depoimento_autor") ?? ""),
  };
  const r = await polirCase(dados);
  if (!r) return { error: "Não consegui polir agora. Tente de novo." };
  return { success: true, ...r };
}

export async function publicarCaseAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const parsed = z.object({ id: uuidLike, publicar: z.boolean() }).safeParse({ id: formData.get("id"), publicar: parseBoolCampo(formData.get("publicar")) });
  if (!parsed.success) return { error: "Dados inválidos" };
  const { data, error } = await sb().from("seo_cases")
    .update({ status: parsed.data.publicar ? "publicado" : "rascunho", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Case não encontrado" };
  revalida();
  return { success: true };
}

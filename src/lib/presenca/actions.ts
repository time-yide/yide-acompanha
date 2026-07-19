"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { parseBoolCampo } from "@/lib/blog/form";
import { getChecklistFeitos } from "./queries";
import { gerarPostPresenca } from "./pipeline";

interface Err { error: string }
type Result = { success: true } | Err;
const uuidLike = z.string().regex(/^[0-9a-fA-F-]{36}$/, "ID inválido");
const canalSchema = z.enum(["gmn", "linkedin"]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }
async function gate(): Promise<{ orgId: string } | Err> {
  const a = await requireAuth();
  if (!podeGerenciarBlog(a.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(a.id);
  if (!orgId) return { error: "Sem organização" };
  return { orgId };
}

export async function gerarPostPresencaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const canal = canalSchema.safeParse(formData.get("canal"));
  if (!canal.success) return { error: "Canal inválido" };
  const ok = await gerarPostPresenca(g.orgId, canal.data, String(formData.get("tema") ?? ""));
  revalidatePath("/programacao/presenca");
  return ok ? { success: true } : { error: "Não consegui gerar agora. Tente de novo." };
}

export async function marcarChecklistAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const canal = canalSchema.safeParse(formData.get("canal"));
  const key = String(formData.get("key") ?? "").trim();
  if (!canal.success || !key) return { error: "Dados inválidos" };
  const feito = parseBoolCampo(formData.get("feito"));
  const atuais = await getChecklistFeitos(g.orgId, canal.data);
  const set = new Set(atuais);
  if (feito) set.add(key); else set.delete(key);
  const { error } = await sb().from("presenca_checklist").upsert(
    { organization_id: g.orgId, canal: canal.data, feitos: [...set], updated_at: new Date().toISOString() },
    { onConflict: "organization_id,canal" });
  if (error) return { error: error.message };
  revalidatePath("/programacao/presenca");
  return { success: true };
}

export async function arquivarPostPresencaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const id = String(formData.get("id") ?? "");
  if (!uuidLike.safeParse(id).success) return { error: "ID inválido" };
  const { data, error } = await sb().from("presenca_posts")
    .update({ status: "arquivado", updated_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Post não encontrado" };
  revalidatePath("/programacao/presenca");
  return { success: true };
}
